import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from,
  }),
}));

import { flushParentDigestEmails } from "@/lib/parent-digest-email";

function pendingChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => ({ error: null, data: rows })),
    update: mocks.update,
  };
  mocks.update.mockReturnValue(chain);
  return chain;
}

function updateChain() {
  const chain: Record<string, unknown> = {
    update: mocks.update,
    eq: vi.fn(async () => ({ error: null })),
  };
  return chain;
}

const okFetch = () =>
  vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockImplementation((table: string) =>
    table === "parent_digests" ? pendingChain([{ id: "d1", parent_email: "p@example.com", body: "hi" }]) : updateChain(),
  );
});

describe("flushParentDigestEmails", () => {
  it("skips entirely when Resend isn't configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const res = await flushParentDigestEmails(okFetch());
    expect(res).toEqual({ emailed: 0, failed: 0, skipped: true });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("mails pending digests and marks them sent", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Learning Fans <no-reply@example.com>";
    const fetchImpl = okFetch();
    const res = await flushParentDigestEmails(fetchImpl);
    expect(res).toEqual({ emailed: 1, failed: 0, skipped: false });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test" }),
      }),
    );
    const body = JSON.parse(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body.to).toEqual(["p@example.com"]);
    expect(body.text).toBe("hi");
    const updateCalls = mocks.update.mock.calls;
    expect(updateCalls.some((c) => c[0].status === "sent")).toBe(true);
  });

  it("marks 4xx rejections failed (no retry) and leaves pending on transport errors", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Learning Fans <no-reply@example.com>";
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 401 })) as unknown as typeof fetch;
    const res = await flushParentDigestEmails(fetchImpl);
    expect(res).toEqual({ emailed: 0, failed: 1, skipped: false });
    expect(mocks.update).toHaveBeenCalledWith({ status: "failed" });

    vi.resetAllMocks();
    mocks.from.mockImplementation((table: string) =>
      table === "parent_digests"
        ? pendingChain([{ id: "d2", parent_email: "p@example.com", body: "hi" }])
        : updateChain(),
    );
    const throwFetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const res2 = await flushParentDigestEmails(throwFetch);
    expect(res2).toEqual({ emailed: 0, failed: 1, skipped: false });
    // Transport errors never flip the row to failed — the next cron retries.
    expect(mocks.update).not.toHaveBeenCalledWith({ status: "failed" });
  });
});