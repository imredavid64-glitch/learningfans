"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Apple, Monitor, Smartphone, Download, Check,
  Laptop, Server,
} from "lucide-react";

type Platform = "ios" | "android" | "mac" | "windows" | "linux" | "unknown";

const PLATFORMS: {
  id: Exclude<Platform, "unknown">;
  label: string;
  icon: typeof Apple;
  desc: string;
  file?: string;
  url?: string;
  note: string;
}[] = [
  {
    id: "ios",
    label: "iOS / iPhone",
    icon: Apple,
    desc: "Native app for iPhone",
    url: "https://apps.apple.com/app/learningfans",
    note: "Install from the App Store (or add to home screen via Safari).",
  },
  {
    id: "android",
    label: "Android",
    icon: Smartphone,
    desc: "Native app for Android",
    file: "/downloads/learningfans-android.apk",
    note: "Download the APK and allow installs from unknown sources if prompted.",
  },
  {
    id: "mac",
    label: "macOS",
    icon: Monitor,
    desc: "Desktop app for Mac",
    file: "/downloads/learningfans-mac.dmg",
    note: "DMG installer. Requires macOS 11 or later.",
  },
  {
    id: "windows",
    label: "Windows",
    icon: Laptop,
    desc: "Desktop app for Windows",
    file: "/downloads/learningfans-windows.exe",
    note: "NSIS installer. Requires Windows 10 or later.",
  },
  {
    id: "linux",
    label: "Linux",
    icon: Server,
    desc: "Desktop app for Linux",
    file: "/downloads/learningfans-linux.AppImage",
    note: "AppImage — make it executable, then run it.",
  },
];

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const plat = navigator.platform || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isMac = /Mac/.test(plat);
  const isWin = /Win/.test(plat);
  const isLinux = /Linux|X11/.test(plat) && !isAndroid;

  if (isIOS) return "ios";
  if (isAndroid) return "android";
  if (isMac) return "mac";
  if (isWin) return "windows";
  if (isLinux) return "linux";
  return "unknown";
}

export function DownloadPageClient() {
  const [detected, setDetected] = useState<Platform>("unknown");
  const [selected, setSelected] = useState<Platform>("unknown");

  useEffect(() => {
    const detectedPlatform = detectPlatform();
    if (detectedPlatform !== "unknown") {
      const id = requestAnimationFrame(() => {
        setDetected(detectedPlatform);
        setSelected(detectedPlatform);
      });
      return () => cancelAnimationFrame(id);
    }
  }, []);

  const active = PLATFORMS.find((x) => x.id === selected);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Get LearningFans</h1>
        <p className="mt-2 text-muted-foreground">
          Take your study community with you. Available on every device you use.
        </p>
      </div>

      {detected !== "unknown" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm flex items-center gap-3">
          <Check className="h-5 w-5 text-primary flex-shrink-0" />
          <span>
            We detected you&apos;re on{" "}
            <strong className="capitalize">{PLATFORMS.find((x) => x.id === detected)?.label || "this device"}</strong>.
            Download below.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const isActive = selected === p.id;
          const isDetected = detected === p.id;
          return (
            <Card
              key={p.id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                isActive ? "border-primary ring-1 ring-primary/30" : ""
              }`}
              onClick={() => setSelected(p.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Icon className="h-8 w-8 text-primary" />
                  {isDetected && <Badge variant="secondary">Your device</Badge>}
                </div>
                <CardTitle className="text-base mt-2">{p.label}</CardTitle>
                <CardDescription>{p.desc}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {active && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">{active.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{active.note}</p>
              </div>
              {active.file ? (
                <a
                  href={active.file}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors flex-shrink-0"
                >
                  <Download className="h-5 w-5" />
                  Download {active.label}
                </a>
              ) : active.url ? (
                <a
                  href={active.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 h-10 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors flex-shrink-0"
                >
                  <Download className="h-5 w-5" />
                  Open {active.label}
                </a>
              ) : (
                <span className="inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-4 h-10 text-sm font-medium text-muted-foreground flex-shrink-0">
                  <Download className="h-5 w-5" />
                  Coming soon
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border bg-card/50 p-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">No installs, no problem.</strong> LearningFans runs entirely in your
          browser at{" "}
          <a href="https://learningfans.vercel.app" className="text-primary underline">learningfans.vercel.app</a>{" "}
          — just sign in on any device. The native and desktop apps wrap the same experience for a faster, more
          integrated feel.
        </p>
      </div>
    </div>
  );
}
