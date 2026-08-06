import { describe, it, expect } from "vitest"
import { containsProfanity } from "@/lib/profanity"

describe("containsProfanity", () => {
  it("does not flag normal academic words", () => {
    const cleanOnes = [
      "class starts at 9am",
      "please turn in the assignment",
      "I need to pass this exam",
      "classification of species",
      "we are using assessment tools",
      "the brass section of the orchestra",
      "grass grows on the campus",
      "unpassable gate",
      "the password for the wifi",
    ]
    for (const s of cleanOnes) {
      expect(containsProfanity(s).clean, s).toBe(true)
    }
  })

  it("flags actual profanity", () => {
    const dirty = ["what the fuck", "shut up bitch", "you asshole", "this is crap", "dick move"]
    for (const s of dirty) {
      expect(containsProfanity(s).clean, s).toBe(false)
    }
  })

  it("catches inflections of profanity", () => {
    expect(containsProfanity("he was shitting on stage").clean).toBe(false)
    expect(containsProfanity("those bitches").clean).toBe(false)
    expect(containsProfanity("dumbass").clean).toBe(false)
    expect(containsProfanity("motherfuckers").clean).toBe(false)
  })

  it("catches leet-speak", () => {
    expect(containsProfanity("sh1t happens").clean).toBe(false)
    expect(containsProfanity("b1tch please").clean).toBe(false)
  })
})