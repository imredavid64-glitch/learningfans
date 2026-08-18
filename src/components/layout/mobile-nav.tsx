"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  Bookmark,
  Home,
  Layers,
  Compass,
  ListOrdered,
  Calendar,
  Video,
  Zap,
  Users,
  BookOpen,
  Search,
  Download,
  Presentation,
  Newspaper,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDemoMode } from "@/lib/demo-mode";
import { hapticLight } from "@/lib/haptics";

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

  const primaryTabs = [
    { href: "/app", icon: Home, label: "Home" },
    { href: "/app/spaces", icon: Layers, label: "Spaces" },
    { href: "/app/study-rooms", icon: Presentation, label: "Study" },
    { href: "/app/meetings", icon: Video, label: "Meetings" },
  ];

  const moreItems = [
    { href: "/app/feed", icon: Newspaper, label: "Feed" },
    { href: "/app/schedule", icon: Calendar, label: "Schedule" },
    { href: "/app/groups", icon: Users, label: "Study Groups" },
    { href: "/app/communities", icon: Compass, label: "Browse Communities" },
    { href: "/app/saved", icon: Bookmark, label: "Saved Items" },
    { href: "/app/priorities", icon: ListOrdered, label: "Priorities" },
    { href: "/app/search", icon: Search, label: "Search" },
    { href: "/app/offline", icon: Download, label: "Offline Mode" },
  ];

  const isMoreActive = moreItems.some((i) => pathname?.startsWith(i.href));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Demo mode indicator on mobile */}
      {demoMode !== "off" && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-1 text-center text-white text-xs font-medium">
          {demoMode === "creator" ? "Creator Studio Mode" : "Fan Feed Mode"}
        </div>
      )}

      <nav className="grid grid-cols-5 items-center border-t bg-background/95 backdrop-blur px-1 py-1.5 safe-area-inset-bottom">
        {primaryTabs.map((item) => {
          const isActive = item.href === "/app" ? pathname === "/app" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => void hapticLight()}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-primary stroke-[2.25]" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* More Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={() => void hapticLight()}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors outline-none ${
              isMoreActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Menu className={`h-5 w-5 ${isMoreActive ? "text-primary stroke-[2.25]" : ""}`} />
            <span>More</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" sideOffset={12} className="w-56 p-1.5">
            <DropdownMenuLabel className="text-xs">Quick Navigation</DropdownMenuLabel>
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => void hapticLight()}
                className="block"
              >
                <DropdownMenuItem className="cursor-pointer py-1.5">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              </Link>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Experience Mode</DropdownMenuLabel>
            <div className="grid grid-cols-3 gap-1 p-1">
              <Button
                variant={demoMode === "off" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDemoMode("off");
                  void hapticLight();
                }}
                className="h-7 text-xs px-1 gap-1"
              >
                <BookOpen className="h-3 w-3" /> Live
              </Button>
              <Button
                variant={demoMode === "creator" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDemoMode("creator");
                  void hapticLight();
                }}
                className="h-7 text-xs px-1 gap-1"
              >
                <Zap className="h-3 w-3" /> Creator
              </Button>
              <Button
                variant={demoMode === "fan" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDemoMode("fan");
                  void hapticLight();
                }}
                className="h-7 text-xs px-1 gap-1"
              >
                <Users className="h-3 w-3" /> Fan
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  );
}
