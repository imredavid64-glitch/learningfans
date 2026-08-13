"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { recordStudySession } from "@/actions/study-rooms";
import {
  applyPomodoroEvent,
  createIdlePomodoro,
  formatCountdown,
  pomodoroDurationSeconds,
  pomodoroRemainingSeconds,
  type PomodoroEvent,
  type PomodoroState,
} from "@/lib/study-room-utils";
import { hapticSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Timer, Pause, Play, RotateCcw, SkipForward } from "lucide-react";

const STORAGE_KEY_PREFIX = "lf-pomodoro-";

function loadStored(roomId: string): PomodoroState {
  if (typeof window === "undefined") return createIdlePomodoro();
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`);
    if (!raw) return createIdlePomodoro();
    const parsed = JSON.parse(raw) as PomodoroState;
    // A stored running timer that already expired resets to idle.
    if (parsed.running && parsed.endsAt <= Date.now()) return createIdlePomodoro();
    return { ...createIdlePomodoro(), ...parsed };
  } catch {
    return createIdlePomodoro();
  }
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // Audio unavailable — silent.
  }
}

export function PomodoroTimer({
  roomId,
  userId,
  disabled,
}: {
  roomId: string;
  userId: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<PomodoroState>(() => loadStored(roomId));
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const transitioningRef = useRef(false);

  // Realtime sync.
  useEffect(() => {
    const supabase = createClient();
    const channel: RealtimeChannel = supabase.channel(`study-room-pomodoro-${roomId}`);
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "pomodoro" }, ({ payload }) => {
        const event = payload as PomodoroEvent;
        if (!event?.action || !event?.mode) return;
        setState((prev) => applyPomodoroEvent(prev, event, Date.now()));
      })
      .subscribe();

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const broadcast = useCallback((event: PomodoroEvent) => {
    channelRef.current?.send({ type: "broadcast", event: "pomodoro", payload: event });
  }, []);

  // Persist + tick.
  useEffect(() => {
    try {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${roomId}`, JSON.stringify(state));
    } catch {
      // Storage unavailable — the timer still works for the session.
    }
  }, [roomId, state]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Auto-transition when a running session hits zero.
  useEffect(() => {
    if (!state.running) return;
    const remaining = pomodoroRemainingSeconds(state, now);
    if (remaining > 0 || transitioningRef.current) return;

    transitioningRef.current = true;
    const nextMode = state.mode === "focus" ? "break" : "focus";
    const endsAt = now + pomodoroDurationSeconds(nextMode) * 1000;
    const event: PomodoroEvent = {
      action: "start",
      mode: nextMode,
      endsAt,
      startedBy: userId,
    };
    setState((prev) => applyPomodoroEvent(prev, event, now));
    broadcast(event);
    beep();
    void hapticSuccess();

    // A focus block just completed — record it for the study-party leaderboard.
    // focusKey is derived from the block's endsAt so every client in the room
    // fires the same key and the upsert dedupes (one row per participant).
    if (state.mode === "focus") {
      void recordStudySession(roomId, `${roomId}:${state.endsAt}`).catch(() => undefined);
    }

    window.setTimeout(() => {
      transitioningRef.current = false;
    }, 1500);
  }, [state, now, userId, broadcast, roomId]);

  const remaining = pomodoroRemainingSeconds(state, now);
  const total = pomodoroDurationSeconds(state.mode);
  const progress = Math.min(100, Math.max(0, ((total - remaining) / total) * 100));

  function start(mode: typeof state.mode) {
    if (disabled) return;
    const nowMs = Date.now();
    // Resuming a paused session of the same mode continues from the frozen
    // remaining time; starting a fresh/skipped session uses the full duration.
    const resumeSameMode = !state.running && state.mode === mode && remaining < total;
    const seconds = resumeSameMode ? remaining : pomodoroDurationSeconds(mode);
    const endsAt = nowMs + seconds * 1000;
    const event: PomodoroEvent = { action: "start", mode, endsAt, startedBy: userId };
    setState((prev) => applyPomodoroEvent(prev, event, nowMs));
    broadcast(event);
  }

  function pause() {
    if (disabled || !state.running) return;
    const nowMs = Date.now();
    setState((prev) => applyPomodoroEvent(prev, { action: "pause", mode: prev.mode, endsAt: 0, startedBy: userId }, nowMs));
    broadcast({ action: "pause", mode: state.mode, endsAt: 0, startedBy: userId });
  }

  function reset() {
    if (disabled) return;
    setState((prev) => applyPomodoroEvent(prev, { action: "reset", mode: "focus", endsAt: 0, startedBy: userId }, Date.now()));
    broadcast({ action: "reset", mode: "focus", endsAt: 0, startedBy: userId });
  }

  const idle = !state.running && remaining >= total;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Timer className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Focus timer</h3>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            state.mode === "focus"
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "bg-green-500/10 text-green-600 dark:text-green-400",
          )}
        >
          {state.mode === "focus" ? "Focus" : "Break"}
        </span>
      </div>

      <div className="mb-3">
        <div className="text-center font-mono text-4xl font-bold tabular-nums">
          {formatCountdown(remaining)}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              state.mode === "focus" ? "bg-blue-500" : "bg-green-500",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {state.running ? (
          <Button size="sm" variant="secondary" className="flex-1 gap-1.5" onClick={pause} disabled={disabled}>
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
        ) : (
          <Button size="sm" className="flex-1 gap-1.5" onClick={() => start(state.mode)} disabled={disabled}>
            <Play className="h-3.5 w-3.5" /> {idle ? "Start focus" : `Resume ${state.mode}`}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => start(state.mode === "focus" ? "break" : "focus")}
          disabled={disabled}
          title={state.mode === "focus" ? "Skip to break" : "Skip to focus"}
        >
          <SkipForward className="h-3.5 w-3.5" /> Skip
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={reset} disabled={disabled} title="Reset timer">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {state.running ? "Running · synced live for everyone in the room" : "Shared with everyone in the room"}
      </p>
    </div>
  );
}
