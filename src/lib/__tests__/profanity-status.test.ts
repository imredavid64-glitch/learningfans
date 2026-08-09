import { describe, it, expect } from "vitest";
import { getToastMessage } from "@/components/moderation/profanity-status-banner";
import type { ProfanityStatus } from "@/components/moderation/profanity-status-banner";

function makeStatus(overrides: Partial<ProfanityStatus> = {}): ProfanityStatus {
  return {
    warnings: 0,
    violations: 0,
    restrictionLevel: "none",
    lastIncidentAt: null,
    parentEmail: null,
    principalEmail: null,
    schoolName: null,
    ...overrides,
  };
}

describe("getToastMessage", () => {
  it("returns null for a clean account", () => {
    expect(getToastMessage(makeStatus())).toBeNull();
  });

  it("returns a suspension message for suspended accounts", () => {
    const msg = getToastMessage(makeStatus({ restrictionLevel: "suspended" }));
    expect(msg).toContain("Account Suspended");
    expect(msg).toContain("Parent and principal have been notified");
  });

  it("returns a restriction message for restricted accounts", () => {
    const msg = getToastMessage(makeStatus({ restrictionLevel: "restricted" }));
    expect(msg).toContain("Account Restricted");
    expect(msg).toContain("read-only");
  });

  it("returns a warning message when there are warnings", () => {
    const msg = getToastMessage(makeStatus({ restrictionLevel: "warning", warnings: 2 }));
    expect(msg).toContain("2 warning(s)");
    expect(msg).toContain("restrict");
  });

  it("returns null for warning level with zero warnings", () => {
    expect(getToastMessage(makeStatus({ restrictionLevel: "warning", warnings: 0 }))).toBeNull();
  });
});
