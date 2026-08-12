import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { DatabaseSetup } from "@/components/setup/database-setup";
import { TimeTracker } from "@/components/layout/time-tracker";
import { MeetingReminderNotifier } from "@/components/meetings/meeting-reminder-notifier";
import { ScheduleReminderNotifier } from "@/components/schedule/schedule-reminder-notifier";
import { MobileNav } from "@/components/layout/mobile-nav";
import { DemoModeProvider } from "@/lib/demo-mode";
import { ProfanityStatusBanner } from "@/components/moderation/profanity-status-banner";
import {
  getCurrentProfile,
  getCurrentUser,
  getSchemaStatus,
} from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schemaStatus = await getSchemaStatus();
  if (schemaStatus === "missing_tables") {
    return (
      <div className="flex min-h-full flex-col">
        <DatabaseSetup />
      </div>
    );
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return (
      <div className="flex min-h-full flex-col">
        <DatabaseSetup />
      </div>
    );
  }

  return (
    <DemoModeProvider>
      <div className="flex min-h-full flex-col">
        <AppNav profile={profile} />
        <TimeTracker />
        <MeetingReminderNotifier />
        <ScheduleReminderNotifier />
        <ProfanityStatusBanner />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <MobileNav />
      </div>
    </DemoModeProvider>
  );
}
