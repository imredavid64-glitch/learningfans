import { getCurrentProfile } from "@/lib/auth";
import { getNotifications } from "@/actions/notifications";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const notifications = await getNotifications(50);

  return <NotificationCenter initialNotifications={notifications} />;
}
