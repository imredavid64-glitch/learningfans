import { describe, expect, it } from "vitest";
import {
  CHAT_MODERATION_BATCH_SIZE,
  isFlagged,
  parseChatBatchResponse,
  type ChatModerationItem,
} from "@/lib/chat-moderation";

const items: ChatModerationItem[] = [
  {
    id: "a",
    message_id: "m1",
    room_id: "r1",
    user_id: "u1",
    content: "hello everyone",
    attempts: 0,
  },
  {
    id: "b",
    message_id: "m2",
    room_id: "r1",
    user_id: "u2",
    content: "buy my course here!!",
    attempts: 0,
  },
  {
    id: "c",
    message_id: "m3",
    room_id: "r1",
    user_id: "u3",
    content: "can someone explain photosynthesis?",
    attempts: 0,
  },
];

describe("parseChatBatchResponse", () => {
  it("maps results back to items by index", () => {
    const verdicts = parseChatBatchResponse(
      JSON.stringify({
        results: [
          { index: 0, is_clean: true, risk_level: "none", violations: [], suggested_action: "allow" },
          { index: 1, is_clean: false, risk_level: "high", violations: ["promotional"], suggested_action: "strike" },
          { index: 2, is_clean: true, risk_level: "low", violations: [], suggested_action: "allow" },
        ],
      }),
      items,
    );

    expect(verdicts).not.toBeNull();
    expect(verdicts!.get("a")!.is_clean).toBe(true);
    expect(verdicts!.get("b")!.risk_level).toBe("high");
    expect(verdicts!.get("b")!.violations).toEqual(["promotional"]);
    expect(verdicts!.get("c")!.is_clean).toBe(true);
  });

  it("skips out-of-range indices and tolerates missing entries", () => {
    const verdicts = parseChatBatchResponse(
      JSON.stringify({ results: [{ index: 99, is_clean: false }] }),
      items,
    );
    expect(verdicts).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseChatBatchResponse("not json", items)).toBeNull();
    expect(parseChatBatchResponse('{"results": "nope"}', items)).toBeNull();
  });

  it("normalizes risk_level and violations to safe shapes", () => {
    const verdicts = parseChatBatchResponse(
      JSON.stringify({
        results: [
          {
            index: 0,
            is_clean: false,
            risk_level: "EXTREME",
            violations: [42, "hate", null],
            suggested_action: 7,
          },
        ],
      }),
      items,
    );
    expect(verdicts!.get("a")!.risk_level).toBe("none");
    expect(verdicts!.get("a")!.violations).toEqual(["hate"]);
    expect(verdicts!.get("a")!.suggested_action).toBeUndefined();
  });
});

describe("isFlagged", () => {
  it("flags medium/high risk unclean content", () => {
    expect(
      isFlagged({ is_clean: false, risk_level: "high", violations: ["hate"] }),
    ).toBe(true);
    expect(
      isFlagged({ is_clean: false, risk_level: "medium", violations: ["spam"] }),
    ).toBe(true);
  });

  it("does not flag clean or low-risk content", () => {
    expect(
      isFlagged({ is_clean: true, risk_level: "none", violations: [] }),
    ).toBe(false);
    expect(
      isFlagged({ is_clean: false, risk_level: "low", violations: ["other"] }),
    ).toBe(false);
  });
});

describe("CHAT_MODERATION_BATCH_SIZE", () => {
  it("keeps batches small enough for one Groq request", () => {
    expect(CHAT_MODERATION_BATCH_SIZE).toBeGreaterThan(0);
    expect(CHAT_MODERATION_BATCH_SIZE).toBeLessThanOrEqual(20);
  });
});
