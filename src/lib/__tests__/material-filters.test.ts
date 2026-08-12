import { describe, it, expect } from "vitest";
import { matchesMaterialFilter } from "@/lib/material-filters";
import type { MaterialType } from "@/lib/constants";

function material(overrides: { type: MaterialType; mime?: string }) {
  return {
    type: overrides.type,
    metadata: overrides.mime ? { mime: overrides.mime } : {},
  };
}

describe("matchesMaterialFilter (materials feed)", () => {
  it("all matches everything", () => {
    expect(matchesMaterialFilter(material({ type: "file", mime: "application/pdf" }), "all")).toBe(true);
    expect(matchesMaterialFilter(material({ type: "note" }), "all")).toBe(true);
  });

  it("pdf filter matches only PDF files", () => {
    expect(matchesMaterialFilter(material({ type: "file", mime: "application/pdf" }), "pdf")).toBe(true);
    expect(matchesMaterialFilter(material({ type: "file", mime: "image/png" }), "pdf")).toBe(false);
    expect(matchesMaterialFilter(material({ type: "link" }), "pdf")).toBe(false);
  });

  it("image filter matches image files only", () => {
    expect(matchesMaterialFilter(material({ type: "file", mime: "image/png" }), "image")).toBe(true);
    expect(matchesMaterialFilter(material({ type: "file", mime: "image/jpeg" }), "image")).toBe(true);
    expect(matchesMaterialFilter(material({ type: "file", mime: "application/pdf" }), "image")).toBe(false);
  });

  it("file filter catches non-pdf non-image uploads", () => {
    expect(matchesMaterialFilter(material({ type: "file", mime: "text/plain" }), "file")).toBe(true);
    expect(matchesMaterialFilter(material({ type: "file", mime: "application/pdf" }), "file")).toBe(false);
    expect(matchesMaterialFilter(material({ type: "file", mime: "image/webp" }), "file")).toBe(false);
  });

  it("link, note and quiz filters map to their types", () => {
    expect(matchesMaterialFilter(material({ type: "link" }), "link")).toBe(true);
    expect(matchesMaterialFilter(material({ type: "note" }), "note")).toBe(true);
    expect(matchesMaterialFilter(material({ type: "flashcard_set" }), "quiz")).toBe(true);
    expect(matchesMaterialFilter(material({ type: "file", mime: "image/png" }), "quiz")).toBe(false);
  });
});
