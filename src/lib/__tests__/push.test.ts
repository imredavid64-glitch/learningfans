import { describe, it, expect } from "vitest";
import { buildPushPayload, validateSubscription } from "@/lib/push";

const VALID = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "BEl62iUYgUivxIkv69yViEuiBIa",
    auth: "CxVd0mMjG4fV0HkH",
  },
};

describe("validateSubscription", () => {
  it("accepts a well-formed subscription", () => {
    expect(validateSubscription(VALID)).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(validateSubscription(null)).toBe(false);
    expect(validateSubscription("nope")).toBe(false);
    expect(validateSubscription(42)).toBe(false);
    expect(validateSubscription(undefined)).toBe(false);
  });

  it("rejects endpoints that aren't https URLs", () => {
    expect(validateSubscription({ ...VALID, endpoint: "http://insecure.example" })).toBe(false);
    expect(validateSubscription({ ...VALID, endpoint: "not-a-url" })).toBe(false);
  });

  it("rejects missing or malformed keys", () => {
    expect(validateSubscription({ ...VALID, keys: {} })).toBe(false);
    expect(validateSubscription({ ...VALID, keys: { p256dh: "", auth: "" } })).toBe(false);
    expect(validateSubscription({ ...VALID, keys: "oops" })).toBe(false);
  });

  it("allows a keys-less subscription object", () => {
    expect(validateSubscription({ endpoint: "https://push.example/x" })).toBe(true);
  });
});

describe("buildPushPayload", () => {
  it("builds a notification payload with defaults", () => {
    expect(buildPushPayload({ title: "New reply" })).toEqual({
      title: "New reply",
      body: "",
      url: "/app",
    });
  });

  it("includes body and link when present", () => {
    expect(
      buildPushPayload({ title: "Meeting", body: "Starts soon", link: "/app/meetings/1" }),
    ).toEqual({ title: "Meeting", body: "Starts soon", url: "/app/meetings/1" });
  });
});
