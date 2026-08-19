"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Award, Flame } from "lucide-react";
import { DirectMessageDrawer } from "@/components/profile/direct-message-drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface UserProfileSummary {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  major?: string | null;
  role?: string | null;
  bio?: string | null;
  xp?: number;
  level?: number;
  streak?: number;
}

export function UserHoverCard({
  user,
  children,
}: {
  user: UserProfileSummary;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const level = user.level ?? (user.xp ? Math.floor(user.xp / 100) + 1 : 1);
  const initials = user.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
        <span className="cursor-pointer font-medium hover:underline inline-flex items-center gap-1">
          {children}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-3 shadow-xl">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border border-border">
            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.display_name} />}
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm truncate">{user.display_name}</span>
              {user.role && user.role !== "member" && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {user.role}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{user.major || "Community Member"}</p>
          </div>
        </div>

        {user.bio && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{user.bio}</p>}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
            <Award className="h-3.5 w-3.5" /> Lvl {level} {user.xp !== undefined && `(${user.xp} XP)`}
          </div>
          {user.streak !== undefined && user.streak > 0 && (
            <div className="flex items-center gap-1 text-orange-500 font-medium">
              <Flame className="h-3.5 w-3.5" /> {user.streak}d streak
            </div>
          )}
        </div>

        <div className="mt-3 pt-1 grid grid-cols-2 gap-2">
          <Link href={`/app/profile/${user.id}`} className="block">
            <Button variant="secondary" size="sm" className="w-full h-7 text-xs gap-1">
              <User className="h-3 w-3" /> Profile
            </Button>
          </Link>
          <DirectMessageDrawer currentUserId="" peerId={user.id} peerName={user.display_name} peerAvatar={user.avatar_url} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
