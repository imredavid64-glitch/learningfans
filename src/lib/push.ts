export interface PushSubscriptionPayload {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

/** Minimal structural validation of a browser PushSubscription JSON. */
export function validateSubscription(raw: unknown): raw is PushSubscriptionPayload {
  if (!raw || typeof raw !== "object") return false;
  const sub = raw as Record<string, unknown>;
  if (typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://")) return false;
  if (sub.keys && typeof sub.keys === "object") {
    const keys = sub.keys as Record<string, unknown>;
    if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return false;
    if (!keys.p256dh || !keys.auth) return false;
  } else if (sub.keys !== undefined && sub.keys !== null) {
    return false;
  }
  return true;
}

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/** VAPID details from env — returns null when push isn't configured. */
export function getVapidConfig(): VapidConfig | null {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
}

/** Payload sent to the push service for a single notification row. */
export function buildPushPayload(notification: {
  title: string;
  body?: string;
  link?: string | null;
}): PushNotificationPayload {
  return {
    title: notification.title,
    body: notification.body || "",
    url: notification.link || "/app",
  };
}
