"use client";

import { useEffect } from "react";
import {
  getAppPlatform,
  getAppShell,
  isNativeApp,
} from "@/lib/platform";

/**
 * Sets data attributes on <html> so global CSS (and components) can adapt to
 * the running shell:
 *   data-platform="ios|android|web"
 *   data-native="true|false"   (Capacitor iOS/Android)
 *   data-app="web|pwa|capacitor|electron"
 */
export function PlatformAdapter() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.platform = getAppPlatform();
    root.dataset.native = isNativeApp() ? "true" : "false";
    root.dataset.app = getAppShell();
  }, []);

  return null;
}
