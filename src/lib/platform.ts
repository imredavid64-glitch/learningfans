import { Capacitor } from "@capacitor/core";

export type AppPlatform = "ios" | "android" | "web";
export type AppShell = "web" | "pwa" | "capacitor" | "electron";

let cachedPlatform: AppPlatform | null = null;

/** "ios" | "android" | "web" — Capacitor reports its native platform when embedded. */
export function getAppPlatform(): AppPlatform {
  if (cachedPlatform) return cachedPlatform;
  const p = Capacitor.getPlatform();
  cachedPlatform = p === "ios" ? "ios" : p === "android" ? "android" : "web";
  return cachedPlatform;
}

/** True when running inside the Capacitor iOS/Android app. */
export function isNativeApp(): boolean {
  return getAppPlatform() !== "web";
}

/** True when running inside the Electron desktop app. */
export function isElectronApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.learningfans?.isElectron);
}

/** True when installed to the home screen as a PWA. */
export function isStandalonePwa(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function getAppShell(): AppShell {
  if (typeof window === "undefined") return "web";
  if (isElectronApp()) return "electron";
  if (isNativeApp()) return "capacitor";
  if (isStandalonePwa()) return "pwa";
  return "web";
}
