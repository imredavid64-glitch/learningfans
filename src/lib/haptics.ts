import { Capacitor } from "@capacitor/core";
import { Haptics as HapticsPlugin, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Haptic feedback for the native iOS/Android apps. Safe to call anywhere:
 * - On web / PWA / Electron it's a no-op (the plugin's web impl).
 * - In native builds that haven't run `npx cap sync` after adding the plugin,
 *   the bridge call fails and is swallowed.
 */

export async function hapticLight(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await HapticsPlugin.impact({ style: ImpactStyle.Light });
  } catch {
    // Plugin not registered in this native build yet.
  }
}

export async function hapticMedium(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await HapticsPlugin.impact({ style: ImpactStyle.Medium });
  } catch {
    // no-op
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await HapticsPlugin.notification({ type: NotificationType.Success });
  } catch {
    // no-op
  }
}
