"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function supportsPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export function PushNotificationSetting() {
  const [supported] = useState(supportsPush);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    void navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (active) setEnabled(Boolean(sub));
      }),
    );
    return () => {
      active = false;
    };
  }, [supported]);

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications aren&apos;t supported in this browser. They work on installed PWA apps and
        modern mobile browsers.
      </p>
    );
  }

  if (!VAPID_PUBLIC_KEY) {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications aren&apos;t configured yet — set the VAPID keys in the environment.
      </p>
    );
  }

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.info("Permission denied — enable notifications in your browser settings to turn this on.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!res.ok) {
        toast.error("Could not save your subscription — try again.");
        return;
      }
      setEnabled(true);
      toast.success("Push notifications enabled");
    } catch (err) {
      console.error("push subscribe failed", err);
      toast.error("Could not enable push notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      setEnabled(false);
      toast.success("Push notifications disabled");
    } catch {
      toast.error("Could not disable push notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {permission === "granted"
          ? "Notifications are allowed for this site."
          : "Your browser is asking before showing notifications."}
      </p>
      <Button
        variant={enabled ? "outline" : "default"}
        size="sm"
        className="gap-1.5"
        onClick={enabled ? disable : enable}
        disabled={busy}
      >
        {enabled ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        {busy ? "Working…" : enabled ? "Disable push notifications" : "Enable push notifications"}
      </Button>
    </div>
  );
}
