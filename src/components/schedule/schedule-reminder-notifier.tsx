"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { hapticLight } from "@/lib/haptics";
import { dismissEventReminder, getDueEventReminders } from "@/actions/schedule";

const POLL_INTERVAL_MS = 60_000;

/** Delivers due schedule-event reminders as toasts (mirrors MeetingReminderNotifier). */
export function ScheduleReminderNotifier() {
  const router = useRouter();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    async function check() {
      const reminders = await getDueEventReminders();
      if (!active) return;

      for (const r of reminders) {
        if (seen.current.has(r.id)) continue;
        seen.current.add(r.id);
        void hapticLight();

        toast(`📅 ${r.eventTitle}`, {
          description: r.text,
          action: {
            label: "View schedule",
            onClick: () => router.push("/app/schedule"),
          },
          cancel: {
            label: "Dismiss",
            onClick: () => {
              void dismissEventReminder(r.id);
            },
          },
          duration: 20_000,
        });
      }
    }

    void check();
    const interval = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
