import Link from "next/link";
import { BookOpen, Calendar, Flag, Home, Layers, ListOrdered, Settings, Shield, Video, GraduationCap, Search, Presentation } from "lucide-react";
import { isModerator, isAdmin } from "@/lib/auth";
import type { Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DemoModeToggle } from "@/components/layout/demo-mode-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

const links = [
  { href: "/app", label: "Dashboard", icon: Home },
  { href: "/app/spaces", label: "Spaces", icon: Layers },
  { href: "/app/study-rooms", label: "Study Rooms", icon: Presentation },
  { href: "/app/meetings", label: "Meetings", icon: Video },
  { href: "/app/schedule", label: "Schedule", icon: Calendar },
  { href: "/app/priorities", label: "Priorities", icon: ListOrdered },
];

export function AppNav({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
      <DemoModeToggle />
      
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/app" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-primary" />
          LearningFans
        </Link>

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
          {isModerator(profile.role) && (
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
          {isAdmin(profile.role) && (
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
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile.display_name}
          </span>
          <Link href="/app/search" aria-label="Search">
            <Button variant="ghost" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </Link>
          <NotificationBell userId={profile.id} />
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
