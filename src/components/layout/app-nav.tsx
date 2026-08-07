"use client";

"use client";

import Link from "next/link";
import { BookOpen, Calendar, Flag, Home, Layers, ListOrdered, Settings, Shield, Video, GraduationCap, Zap, Users, Trophy, Brain } from "lucide-react";
import { isModerator, isAdmin } from "@/lib/auth";
import type { Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useDemoMode, DEMO_CREATOR_PROFILE, DEMO_FAN_PROFILE } from "@/lib/demo-mode";
import { Badge } from "@/components/ui/badge";

const links = [
  { href: "/app", label: "Dashboard", icon: Home },
  { href: "/app/spaces", label: "Spaces", icon: Layers },
  { href: "/app/priorities", label: "Priorities", icon: ListOrdered },
  { href: "/app/schedule", label: "Schedule", icon: Calendar },
  { href: "/app/meetings", label: "Meetings", icon: Video },
];

export function AppNav({ profile }: { profile: Profile }) {
  const { demoMode, setDemoMode, isDemoMode } = useDemoMode();
  const displayProfile = demoMode === "creator" ? DEMO_CREATOR_PROFILE : demoMode === "fan" ? DEMO_FAN_PROFILE : profile;

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
      {/* Judge Guidance Banner */}
      {isDemoMode && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-center text-white text-sm font-medium animate-pulse">
          🎯 LearningFans Dual-Mode Active: Toggle between Creator Studio and Student Fan Feed to test the full ecosystem
        </div>
      )}
      
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/app" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-primary" />
          LearningFans
        </Link>

        {/* Demo Mode Toggle */}
        <div className="hidden md:flex items-center gap-2 ml-4">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <Button
              variant={demoMode === "off" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDemoMode("off")}
              className="h-8 px-3"
            >
              <Brain className="h-3.5 w-3.5 mr-1" /> Live
            </Button>
            <Button
              variant={demoMode === "creator" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDemoMode("creator")}
              className="h-8 px-3"
            >
              <Zap className="h-3.5 w-3.5 mr-1" /> Creator
            </Button>
            <Button
              variant={demoMode === "fan" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDemoMode("fan")}
              className="h-8 px-3"
            >
              <Users className="h-3.5 w-3.5 mr-1" /> Fan
            </Button>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {isModerator(displayProfile.role) && (
            <Link
              href="/app/mod"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Flag className="h-4 w-4" />
              Moderation
            </Link>
          )}
          <Link
            href="/app/study-hub"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <GraduationCap className="h-4 w-4" />
            Study Hub
          </Link>
          {isAdmin(displayProfile.role) && (
            <Link
              href="/app/admin"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline flex items-center gap-1.5">
            {displayProfile.display_name}
            {isDemoMode && (
              <Badge variant="secondary" className="text-xs h-5 px-2 gap-1">
                {demoMode === "creator" ? (
                  <>
                    <Zap className="h-3 w-3" /> Creator Studio
                  </>
                ) : (
                  <>
                    <Trophy className="h-3 w-3" /> Fan Feed
                  </>
                )}
              </Badge>
            )}
          </span>
          <Link href="/app/settings">
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <SignOutButton variant="outline" size="sm">
            Sign out
          </SignOutButton>
        </div>
      </div>
    </header>
  );
}
