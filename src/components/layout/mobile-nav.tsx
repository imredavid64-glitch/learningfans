"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Home, Layers, ListOrdered, Calendar, Video, Zap, Users, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/lib/demo-mode";

function subscribeToViewport(callback: () => void) {
  const mql = window.matchMedia("(min-width: 768px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 768px)").matches;
}

function isDesktopServer(): boolean {
  return false;
}

export function MobileNav() {
  const pathname = usePathname();
  const { demoMode, setDemoMode } = useDemoMode();
  const desktop = useSyncExternalStore(subscribeToViewport, isDesktop, isDesktopServer);

  if (desktop) return null;

  const navItems = [
    { href: "/app", icon: Home, label: "Home" },
    { href: "/app/spaces", icon: Layers, label: "Spaces" },
    { href: "/app/priorities", icon: ListOrdered, label: "Priorities" },
    { href: "/app/schedule", icon: Calendar, label: "Schedule" },
    { href: "/app/meetings", icon: Video, label: "Meetings" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Demo mode indicator on mobile */}
      {demoMode !== "off" && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-1.5 text-center text-white text-xs font-medium">
          {demoMode === "creator" ? "Creator Studio Mode" : "Fan Feed Mode"}
        </div>
      )}
      
      <nav className="flex items-center justify-between border-t bg-background px-2 py-2 safe-area-inset-bottom">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Demo mode toggle on mobile */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant={demoMode === "off" ? "default" : "ghost"}
            size="icon"
            onClick={() => setDemoMode("off")}
            className="h-9 w-9"
            aria-label="Live mode"
          >
            <BookOpen className="h-4 w-4" />
          </Button>
          <Button
            variant={demoMode === "creator" ? "default" : "ghost"}
            size="icon"
            onClick={() => setDemoMode("creator")}
            className="h-9 w-9"
            aria-label="Creator mode"
          >
            <Zap className="h-4 w-4" />
          </Button>
          <Button
            variant={demoMode === "fan" ? "default" : "ghost"}
            size="icon"
            onClick={() => setDemoMode("fan")}
            className="h-9 w-9"
            aria-label="Fan mode"
          >
            <Users className="h-4 w-4" />
          </Button>
        </div>
      </nav>
    </div>
  );
}
