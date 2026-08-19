import Link from "next/link";
import {
  Bookmark,
  BookOpen,
  Calendar,
  Compass,
  Flag,
  Home,
  Layers,
  ListOrdered,
  Newspaper,
  Settings,
  Shield,
  Video,
  GraduationCap,
  Presentation,
  Users,
  ChevronDown,
} from "lucide-react";
import { isModerator, isAdmin } from "@/lib/auth";
import type { Profile } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DemoModeToggle } from "@/components/layout/demo-mode-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CommandPalette } from "@/components/layout/command-palette";

const primaryLinks = [
  { href: "/app", label: "Dashboard", icon: Home },
  { href: "/app/spaces", label: "Spaces", icon: Layers },
  { href: "/app/feed", label: "Feed", icon: Newspaper },
  { href: "/app/study-rooms", label: "Study Rooms", icon: Presentation },
  { href: "/app/meetings", label: "Meetings", icon: Video },
  { href: "/app/schedule", label: "Schedule", icon: Calendar },
];

const secondaryLinks = [
  { href: "/app/groups", label: "Study Groups", icon: Users },
  { href: "/app/communities", label: "Browse Communities", icon: Compass },
  { href: "/app/priorities", label: "Study Priorities", icon: ListOrdered },
  { href: "/app/saved", label: "Saved Items", icon: Bookmark },
  { href: "/app/study-hub", label: "Study Hub AI", icon: GraduationCap },
];

export function AppNav({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
      <DemoModeToggle />
      
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/app" className="flex items-center gap-2 font-semibold shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline font-bold">LearningFans</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {primaryLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none">
              More <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {secondaryLinks.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="block">
                  <DropdownMenuItem className="cursor-pointer">
                    <Icon className="h-4 w-4" />
                    {label}
                  </DropdownMenuItem>
                </Link>
              ))}

              {(isModerator(profile.role) || isAdmin(profile.role)) && (
                <DropdownMenuSeparator />
              )}

              {isModerator(profile.role) && (
                <Link href="/app/mod" className="block">
                  <DropdownMenuItem className="cursor-pointer text-amber-600 dark:text-amber-400">
                    <Flag className="h-4 w-4" />
                    Moderation
                  </DropdownMenuItem>
                </Link>
              )}

              {isAdmin(profile.role) && (
                <Link href="/app/admin" className="block">
                  <DropdownMenuItem className="cursor-pointer text-primary font-medium">
                    <Shield className="h-4 w-4" />
                    Admin Panel
                  </DropdownMenuItem>
                </Link>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile.display_name}
          </span>
          <CommandPalette />
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
