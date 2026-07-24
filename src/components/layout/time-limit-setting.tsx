"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "lf-time-tracker";
const DEFAULT_DAILY_LIMIT = 120;

export function TimeLimitSetting() {
  const [limit, setLimit] = useState(DEFAULT_DAILY_LIMIT);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setLimit(data.dailyLimit || DEFAULT_DAILY_LIMIT);
        if (data.date === new Date().toISOString().slice(0, 10)) {
          setTodayMinutes(data.elapsedMinutes || 0);
        }
      }
    } catch {}
  }, []);

  function save() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data.dailyLimit = limit;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }

  function resetToday() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data.elapsedMinutes = 0;
      data.date = new Date().toISOString().slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setTodayMinutes(0);
    } catch {}
  }

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time Tracker
        </CardTitle>
        <CardDescription>
          Set a daily time limit. You&apos;ll get a warning at 80% and an alert when you hit the limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="dailyLimit">Daily limit (minutes)</Label>
            <div className="flex items-center gap-2">
              <input
                id="dailyLimit"
                type="number"
                min={15}
                max={600}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="flex h-10 w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <span className="text-sm text-muted-foreground">
                ({formatTime(limit)})
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            Today: <strong>{formatTime(todayMinutes)}</strong> spent
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted-foreground/20">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (todayMinutes / limit) * 100)}%`,
                backgroundColor:
                  todayMinutes >= limit
                    ? "var(--color-destructive)"
                    : todayMinutes >= limit * 0.8
                    ? "#f59e0b"
                    : "var(--color-primary)",
              }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} size="sm">
            {saved ? "Saved" : "Save limit"}
          </Button>
          <Button onClick={resetToday} variant="outline" size="sm">
            Reset today
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
