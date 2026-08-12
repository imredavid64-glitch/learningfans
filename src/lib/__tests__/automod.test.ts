import { describe, it, expect } from "vitest";
import {
  checkAutomod,
  ruleMatchesKeywords,
  validateAutomodRules,
  MAX_AUTOMOD_RULES,
  MAX_RULE_NAME,
  type AutomodRule,
} from "@/lib/automod";

const base: AutomodRule = {
  id: "r1",
  name: "No spam",
  keywords: "free vip, earn money fast",
  scope: "all",
  action: "remove",
};

describe("validateAutomodRules", () => {
  it("accepts valid rules and normalizes whitespace", () => {
    const res = validateAutomodRules([
      { id: "a", name: "  Spam  ", keywords: "  buy now  ", scope: "all", action: "flag" },
      { name: "No id", keywords: "x", scope: "post", action: "remove" },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.rules).toHaveLength(2);
      expect(res.rules[0].name).toBe("Spam");
      expect(res.rules[1].id).toBeTruthy();
    }
  });

  it("rejects bad input", () => {
    expect(validateAutomodRules(null).ok).toBe(false);
    expect(validateAutomodRules([{ name: "", keywords: "x", scope: "all", action: "flag" }]).ok).toBe(false);
    expect(validateAutomodRules([{ name: "x", keywords: "", scope: "all", action: "flag" }]).ok).toBe(false);
    expect(validateAutomodRules([{ name: "x", keywords: "y", scope: "reply", action: "flag" }]).ok).toBe(false);
    expect(validateAutomodRules([{ name: "x", keywords: "y", scope: "all", action: "ban" }]).ok).toBe(false);
    expect(validateAutomodRules([{ name: "x".repeat(MAX_RULE_NAME + 1), keywords: "y", scope: "all", action: "flag" }]).ok).toBe(false);
  });

  it("enforces the max count and duplicate ids", () => {
    const many = Array.from({ length: MAX_AUTOMOD_RULES + 1 }, (_, i) => ({
      id: `r${i}`,
      name: `Rule ${i}`,
      keywords: "spam",
      scope: "all" as const,
      action: "flag" as const,
    }));
    expect(validateAutomodRules(many).ok).toBe(false);
    expect(
      validateAutomodRules([
        { id: "a", name: "X", keywords: "x", scope: "all", action: "flag" },
        { id: "a", name: "Y", keywords: "y", scope: "all", action: "flag" },
      ]).ok,
    ).toBe(false);
  });
});

describe("ruleMatchesKeywords / checkAutomod", () => {
  it("matches any comma-separated keyword case-insensitively", () => {
    expect(ruleMatchesKeywords(base, "Get FREE VIP access today")).toBe(true);
    expect(ruleMatchesKeywords(base, "How do I earn money fast?")).toBe(true);
    expect(ruleMatchesKeywords(base, "This is a normal study note")).toBe(false);
  });

  it("ignores empty keyword segments", () => {
    const r = { ...base, keywords: "  , spam ,, " };
    expect(ruleMatchesKeywords(r, "some spam here")).toBe(true);
  });

  it("respects scope", () => {
    const threadOnly: AutomodRule = { ...base, scope: "thread" };
    expect(checkAutomod([threadOnly], "free vip deal", "thread")?.id).toBe("r1");
    expect(checkAutomod([threadOnly], "free vip deal", "post")).toBeNull();
    expect(checkAutomod([threadOnly], "free vip deal", "all")).toBeNull();
    const all: AutomodRule = { ...base, scope: "all" };
    expect(checkAutomod([all], "free vip deal", "post")?.id).toBe("r1");
    expect(checkAutomod([all], "free vip deal", "thread")?.id).toBe("r1");
  });

  it("returns the first matching rule in order", () => {
    const first: AutomodRule = { ...base, keywords: "alpha", action: "flag" };
    const second: AutomodRule = { ...base, id: "r2", keywords: "beta", action: "remove" };
    const match = checkAutomod([first, second], "I love beta waves", "thread");
    expect(match?.id).toBe("r2");
    expect(checkAutomod([first, second], "alpha state", "post")?.id).toBe("r1");
  });
});
