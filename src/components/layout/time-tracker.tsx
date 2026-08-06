"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, AlertTriangle, TimerOff } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lf-time-tracker";
const DEFAULT_DAILY_LIMIT = 120;

interface TimeData {
  date: string;
  elapsedMinutes: number;
  dailyLimit: number;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadTimeData(): TimeData {
  if (typeof window === "undefined") {
    return { date: getToday(), elapsedMinutes: 0, dailyLimit: DEFAULT_DAILY_LIMIT };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as TimeData;
      if (data.date === getToday()) return data;
    }
  } catch {}
  return { date: getToday(), elapsedMinutes: 0, dailyLimit: DEFAULT_DAILY_LIMIT };
}

function saveTimeData(data: TimeData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function TimeTracker() {
  const [timeData, setTimeData] = useState<TimeData>(loadTimeData);
  const [sessionStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);

  const sessionMinutes = (now - sessionStart) / 60000;
  const totalMinutes = timeData.elapsedMinutes + sessionMinutes;
  const limit = timeData.dailyLimit;
  const usagePercent = Math.min(100, (totalMinutes / limit) * 100);
  const isOverLimit = totalMinutes >= limit;
  const isWarning = usagePercent >= 80 && !isOverLimit;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleSave = () => {
      const current = loadTimeData();
      current.elapsedMinutes = totalMinutes;
      saveTimeData(current);
    };
    window.addEventListener("beforeunload", handleSave);
    return () => window.removeEventListener("beforeunload", handleSave);
  }, [totalMinutes]);

  const formatTime = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const resetTime = useCallback(() => {
    const data = loadTimeData();
    data.elapsedMinutes = 0;
    saveTimeData(data);
    setTimeData(data);
    setDismissed(false);
  }, []);

  const getColor = () => {
    if (isOverLimit) return "text-destructive";
    if (isWarning) return "text-amber-500";
    return "text-muted-foreground";
  };

  return (
    <>
      <button
        onClick={() => setDismissed(false)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
          getColor(),
          isOverLimit ? "hover:bg-destructive/10" : isWarning ? "hover:bg-amber-500/10" : "hover:bg-accent",
        )}
        title={isOverLimit ? "Daily limit reached! Click to manage." : `${formatTime(totalMinutes)} / ${formatTime(limit)}`}
      >
        {isOverLimit ? <TimerOff className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{formatTime(totalMinutes)}</span>
      </button>

      {isOverLimit && !dismissed && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 backdrop-blur">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Time limit reached</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You&apos;ve spent {formatTime(totalMinutes)} on LearningFans today (limit: {formatTime(limit)}).
                Consider taking a break.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={resetTime}
                  className="rounded-md bg-destructive/20 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/30"
                >
                  Reset timer
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isWarning && !isOverLimit && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 backdrop-blur">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Heads up</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You&apos;ve used {usagePercent.toFixed(0)}% of your daily time budget ({formatTime(totalMinutes)} / {formatTime(limit)}).
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setDismissed(true)}
                  className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
