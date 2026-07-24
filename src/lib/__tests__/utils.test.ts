import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("combines class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("merges Tailwind classes (last wins)", () => {
    expect(cn("px-4", "px-2")).toBe("px-2")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra")
  })

  it("handles undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b")
  })
})
