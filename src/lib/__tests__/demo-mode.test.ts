import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getDemoModeSnapshot,
  getDemoModeServerSnapshot,
} from "@/lib/demo-mode";

const STORAGE_KEY = "learningfans-demo-mode";

describe("getDemoModeSnapshot", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns 'off' when nothing is stored", () => {
    expect(getDemoModeSnapshot()).toBe("off");
  });

  it("returns the stored creator mode", () => {
    window.localStorage.setItem(STORAGE_KEY, "creator");
    expect(getDemoModeSnapshot()).toBe("creator");
  });

  it("returns the stored fan mode", () => {
    window.localStorage.setItem(STORAGE_KEY, "fan");
    expect(getDemoModeSnapshot()).toBe("fan");
  });

  it("falls back to 'off' for an unknown stored value", () => {
    window.localStorage.setItem(STORAGE_KEY, "admin");
    expect(getDemoModeSnapshot()).toBe("off");
  });

  it("falls back to 'off' for an empty string", () => {
    window.localStorage.setItem(STORAGE_KEY, "");
    expect(getDemoModeSnapshot()).toBe("off");
  });
});

describe("getDemoModeServerSnapshot", () => {
  it("always returns 'off' to keep SSR output stable", () => {
    expect(getDemoModeServerSnapshot()).toBe("off");
  });
});
