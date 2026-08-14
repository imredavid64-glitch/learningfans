import { describe, it, expect, vi, beforeEach } from "vitest";

// Everything the route touches besides its own logic is mocked, so the tests
// assert the dry-mode contract: config checks + short-circuit, no side effects.
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  getVapidConfig: vi.fn(),
  drainChatModerationQueue: vi.fn(),
  sendPartyReminders: vi.fn(),
  checkAndArchive: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("@/lib/push", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/push")>();
  return { ...actual, getVapidConfig: mocks.getVapidConfig };
});
vi.mock("@/lib/chat-moderation", () => ({
  drainChatModerationQueue: mocks.drainChatModerationQueue,
}));
vi.mock("@/lib/party-reminders", () => ({
  sendPartyReminders: mocks.sendPartyReminders,
}));
vi.mock("@/lib/supabase/server", () => ({
  checkAndArchive: mocks.checkAndArchive,
}));

import webpush from "web-push";
import { GET } from "./route";

// Real generated keys so the non-dry path's setVapidDetails validation passes.
const KEYS = webpush.generateVAPIDKeys();
const VAPID = {
  subject: "mailto:test@example.com",
  publicKey: KEYS.publicKey,
  privateKey: KEYS.privateKey,
};

// Fully chainable query builder whose terminal .limit() resolves empty data.
function okChain() {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    is: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    limit: vi.fn(async () => ({ error: null, data: [] })),
  };
  return chain;
}

const dryRequest = (auth: string) =>
  new Request("http://localhost/api/push/send?dry=1", {
    headers: { authorization: auth },
  });

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "test-secret";
  mocks.from.mockReturnValue(okChain());
  mocks.getVapidConfig.mockReturnValue(VAPID);
});

describe("GET /api/push/send", () => {
  it("401s without a matching CRON_SECRET", async () => {
    const res = await GET(dryRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    // Side effects never run on an unauthenticated call either.
    expect(mocks.drainChatModerationQueue).not.toHaveBeenCalled();
  });

  it("503s when VAPID env is not configured", async () => {
    mocks.getVapidConfig.mockReturnValue(null);
    const res = await GET(dryRequest("Bearer test-secret"));
    expect(res.status).toBe(503);
    expect(mocks.drainChatModerationQueue).not.toHaveBeenCalled();
  });

  it("dry mode reports full configuration and performs NO side effects", async () => {
    const res = await GET(dryRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("dry");
    expect(body.auth).toBe("ok");
    expect(body.vapid).toEqual({
      configured: true,
      subject: VAPID.subject,
      publicKey: VAPID.publicKey,
    });
    expect(body.vapid).not.toHaveProperty("privateKey");
    expect(body.db).toEqual({
      push_subscriptions: "ok",
      notifications: "ok",
    });
    // The whole point of dry mode: nothing drains, archives, sends, or reminds.
    expect(mocks.drainChatModerationQueue).not.toHaveBeenCalled();
    expect(mocks.checkAndArchive).not.toHaveBeenCalled();
    expect(mocks.sendPartyReminders).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("dry mode flags missing tables instead of failing silently", async () => {
    mocks.from.mockReturnValue(
      okChain() as ReturnType<typeof okChain> & { limit: unknown },
    );
    // Force every terminal .limit() to report an error (missing table).
    mocks.from.mockImplementation(() => {
      const chain = okChain();
      chain.limit = vi.fn(async () => ({ error: { message: "not found" }, data: null }));
      return chain;
    });
    const res = await GET(dryRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toEqual({
      push_subscriptions: "missing",
      notifications: "missing",
    });
  });

  it("non-dry requests still run the pipeline (dry is the short-circuit)", async () => {
    mocks.sendPartyReminders.mockResolvedValue({ reminded: 0 });
    mocks.drainChatModerationQueue.mockResolvedValue(undefined);
    mocks.checkAndArchive.mockResolvedValue(undefined);
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    const res = await GET(
      new Request("http://localhost/api/push/send", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    // The side-effectful path is what runs without ?dry=1.
    expect(mocks.sendPartyReminders).toHaveBeenCalled();
    expect(mocks.drainChatModerationQueue).toHaveBeenCalled();
    expect(mocks.checkAndArchive).toHaveBeenCalled();
  });
});
