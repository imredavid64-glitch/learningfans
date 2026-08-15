import { describe, it, expect, vi, beforeEach } from "vitest";

// Everything the route touches besides its own logic is mocked, so the tests
// assert the dry-mode contract: config probe + short-circuit, no digests sent.
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  sendPartyReminders: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("@/lib/party-reminders", () => ({
  sendPartyReminders: mocks.sendPartyReminders,
}));

import { GET } from "./route";

// Fully chainable query builder whose terminal .limit() resolves empty data.
function okChain() {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    limit: vi.fn(async () => ({ error: null, data: [] })),
  };
  return chain;
}

const dryRequest = (auth: string) =>
  new Request("http://localhost/api/cron/digest?dry=1", {
    headers: { authorization: auth },
  });

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "test-secret";
  mocks.from.mockReturnValue(okChain());
  mocks.rpc.mockResolvedValue({ error: null, data: 0 });
  mocks.sendPartyReminders.mockResolvedValue({ reminded: 0 });
});

describe("GET /api/cron/digest", () => {
  it("401s without a matching CRON_SECRET", async () => {
    const res = await GET(dryRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("dry mode reports the digest pipeline surface and sends NOTHING", async () => {
    const res = await GET(dryRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("dry");
    expect(body.auth).toBe("ok");
    expect(body.db).toEqual({
      notifications: "ok",
      parent_digests: "ok",
      user_stats: "ok",
      get_leaderboard: "ok",
    });
    // The whole point of dry mode: the digest-sending RPCs and reminders never run.
    expect(mocks.rpc).toHaveBeenCalledWith("get_leaderboard", { p_limit: 1 });
    expect(mocks.rpc).not.toHaveBeenCalledWith("send_weekly_digests");
    expect(mocks.rpc).not.toHaveBeenCalledWith("send_parent_digests");
    expect(mocks.sendPartyReminders).not.toHaveBeenCalled();
  });

  it("dry mode flags missing tables instead of failing silently", async () => {
    mocks.from.mockImplementation(() => {
      const chain = okChain();
      chain.limit = vi.fn(async () => ({ error: { message: "not found" }, data: null }));
      return chain;
    });
    mocks.rpc.mockResolvedValue({ error: { message: "not found" }, data: null });
    const res = await GET(dryRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toEqual({
      notifications: "missing",
      parent_digests: "missing",
      user_stats: "missing",
      get_leaderboard: "missing",
    });
  });

  it("non-dry requests still send digests + reminders (dry is the short-circuit)", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 3, error: null }); // send_weekly_digests
    mocks.rpc.mockResolvedValueOnce({ data: 1, error: null }); // send_parent_digests
    const res = await GET(
      new Request("http://localhost/api/cron/digest", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(3);
    expect(body.parentDigests).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith("send_weekly_digests");
    expect(mocks.rpc).toHaveBeenCalledWith("send_parent_digests");
    expect(mocks.sendPartyReminders).toHaveBeenCalled();
  });
});
