import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck, Inbox } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, string> = {
  material: "📄",
  thread: "💬",
  reply: "↩️",
  mention: "👋",
  meeting: "🎥",
  event: "📅",
  streak: "🔥",
  system: "🔔",
};

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const notifications = await getNotifications(50);
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "You're all caught up"} · {notifications.length} total
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          </form>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-3 h-8 w-8 opacity-50" />
              No notifications yet. New materials, threads, and meetings in your spaces will show up here.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 text-sm",
                  !n.read_at && "bg-primary/5",
                )}
              >
                <span className="text-lg leading-none">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {n.link ? (
                      <Link href={n.link} className="font-medium hover:underline">
                        {n.title}
                      </Link>
                    ) : (
                      <p className="font-medium">{n.title}</p>
                    )}
                    {!n.read_at && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.read_at && (
                  <form action={markNotificationRead.bind(null, n.id)}>
                    <Button variant="ghost" size="sm">
                      Mark read
                    </Button>
                  </form>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
