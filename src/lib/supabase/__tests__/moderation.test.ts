import { describe, it, expect, vi, beforeEach } from "vitest"
import { checkContentWithAI } from "@/lib/supabase/server"

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockGroqResponse(result: Record<string, unknown>) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: JSON.stringify(result) } }],
      }),
  })
}

describe("checkContentWithAI", () => {
  it("returns clean for appropriate content", async () => {
    mockGroqResponse({
      is_clean: true,
      risk_level: "none",
      violations: [],
      suggested_action: "allow",
    })

    const result = await checkContentWithAI("What is the derivative of x^2?")
    expect(result.is_clean).toBe(true)
    expect(result.risk_level).toBe("none")
    expect(result.suggested_action).toBe("allow")
  })

  it("detects profanity", async () => {
    mockGroqResponse({
      is_clean: false,
      risk_level: "high",
      violations: ["profanity"],
      suggested_action: "strike",
    })

    const result = await checkContentWithAI("some bad words here")
    expect(result.is_clean).toBe(false)
    expect(result.violations).toContain("profanity")
    expect(result.suggested_action).toBe("strike")
  })

  it("falls back to allow on API error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"))

    const result = await checkContentWithAI("test")
    expect(result.is_clean).toBe(true)
    expect(result.suggested_action).toBe("allow")
    expect(result.violations).toEqual([])
  })

  it("falls back on malformed JSON response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "not json at all" } }],
        }),
    })

    const result = await checkContentWithAI("test")
    expect(result.is_clean).toBe(true)
    expect(result.suggested_action).toBe("allow")
  })
})
