"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck, Inbox, Filter, CheckCircle, Bell } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NotificationRow } from "@/types/database";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, string> = {
  material: "📄",
  thread: "💬",
  reply: "↩️",
  mention: "👋",
  meeting: "🎥",
  event: "📅",
  streak: "🔥",
  digest: "📬",
  system: "🔔",
};

const CATEGORY_MAP: Record<string, string[]> = {
  all: [],
  unread: [],
  discussions: ["thread", "reply", "mention"],
  collab: ["meeting", "event"],
  community: ["material", "digest", "system", "streak"],
};

export function NotificationCenter({
  initialNotifications,
}: {
  initialNotifications: NotificationRow[];
}) {
  const [notifications, setNotifications] = useState<NotificationRow[]>(initialNotifications);
  const [activeTab, setActiveTab] = useState<string>("all");

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread") return !n.read_at;
    if (activeTab === "discussions") return CATEGORY_MAP.discussions.includes(n.type);
    if (activeTab === "collab") return CATEGORY_MAP.collab.includes(n.type);
    if (activeTab === "community") return CATEGORY_MAP.community.includes(n.type);
    return true; // 'all'
  });

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    await markNotificationRead(id);
  };

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
    await markAllNotificationsRead();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread activity updates` : "You're all caught up!"} ·{" "}
            {notifications.length} total
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 text-muted-foreground mr-1 shrink-0" />
        {[
          { id: "all", label: "All Activity", count: notifications.length },
          { id: "unread", label: "Unread", count: unreadCount },
          {
            id: "discussions",
            label: "Discussions & Mentions",
            count: notifications.filter((n) => CATEGORY_MAP.discussions.includes(n.type)).length,
          },
          {
            id: "collab",
            label: "Meetings & Events",
            count: notifications.filter((n) => CATEGORY_MAP.collab.includes(n.type)).length,
          },
          {
            id: "community",
            label: "Community & System",
            count: notifications.filter((n) => CATEGORY_MAP.community.includes(n.type)).length,
          },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            className="rounded-full text-xs h-7 gap-1.5 shrink-0"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge
                variant={activeTab === tab.id ? "secondary" : "outline"}
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {tab.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Activity Feed</span>
            <span className="text-xs font-normal text-muted-foreground">
              Showing {filteredNotifications.length} items
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-3 h-8 w-8 opacity-50" />
              No notifications found for this filter.
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 text-sm transition-colors",
                  !n.read_at && "bg-primary/5 border-primary/20",
                )}
              >
                <span className="text-lg leading-none mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {n.link ? (
                      <Link href={n.link} className="font-medium hover:underline text-foreground">
                        {n.title}
                      </Link>
                    ) : (
                      <p className="font-medium text-foreground">{n.title}</p>
                    )}
                    {!n.read_at && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.read_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs shrink-0 gap-1 hover:text-primary"
                    onClick={() => handleMarkRead(n.id)}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
