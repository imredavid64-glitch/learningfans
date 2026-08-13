"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { saveWhiteboard, clearWhiteboard, pinWhiteboardToSpace } from "@/actions/study-rooms";
import {
  capStrokes,
  isValidWhiteboard,
  cursorColor,
  strokeRenderColor,
  type WhiteboardPoint,
  type WhiteboardStroke,
} from "@/lib/study-room-utils";
import {
  OFFLINE_ROOM_SYNC_EVENT,
  clearPendingWhiteboard,
  loadPendingWhiteboard,
  savePendingWhiteboard,
} from "@/lib/offline-room-sync";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Eraser,
  PenLine,
  Trash2,
  Undo2,
  Loader2,
  Download,
  Pin,
  Palette,
  CloudOff,
} from "lucide-react";

const COLORS = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#9333ea", "#ea580c"];
const WIDTHS = [2, 5, 10, 18];
const CURSOR_TRACK_MS = 100; // ~10 Hz presence updates per cursor

interface WhiteboardProps {
  roomId: string;
  userId: string;
  displayName: string;
  initialStrokes: unknown;
  readOnly?: boolean;
  /** Space the room belongs to — enables "Pin to community". */
  spaceSlug?: string | null;
  roomName?: string;
}

type CursorPresence = {
  user_id: string;
  display_name: string;
  x: number | null;
  y: number | null;
};

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function Whiteboard({
  roomId,
  userId,
  displayName,
  initialStrokes,
  readOnly,
  spaceSlug,
  roomName,
}: WhiteboardProps) {
  function initStrokes(): WhiteboardStroke[] {
    return isValidWhiteboard(initialStrokes) ? initialStrokes : [];
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<WhiteboardStroke[]>(initStrokes());
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>(initStrokes);
  const [cursors, setCursors] = useState<Map<string, CursorPresence>>(new Map());
  const cursorsRef = useRef<Map<string, CursorPresence>>(new Map());
  const lastCursorTrackRef = useRef(0);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [byPerson, setByPerson] = useState(true);
  const byPersonRef = useRef(true);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [pendingOffline, setPendingOffline] = useState(false);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Distinct authors who have drawn on this board (for the per-person legend).
  const authors = [...new Map(
    strokes
      .filter((s) => s.author_id)
      .map((s) => [s.author_id!, { id: s.author_id!, name: s.author_name ?? "" }]),
  ).values()];

  /** Keep the ref (drawing/save source of truth) in sync with state. */
  function commitStrokes(updater: (prev: WhiteboardStroke[]) => WhiteboardStroke[]) {
    strokesRef.current = updater(strokesRef.current);
    setStrokes(strokesRef.current);
  }

  // --- Rendering -----------------------------------------------------------
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = sizeCanvas(canvas, container);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokesRef.current) {
      drawStroke(ctx, s, strokeRenderColor(s, byPersonRef.current));
    }
  }, []);

  const redrawCursors = useCallback(() => {
    const overlay = cursorCanvasRef.current;
    const container = containerRef.current;
    if (!overlay || !container) return;
    const dpr = sizeCanvas(overlay, container);
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr);
    for (const cursor of cursorsRef.current.values()) {
      if (cursor.x == null || cursor.y == null) continue;
      drawCursor(ctx, dpr, cursor);
    }
  }, []);

  useEffect(() => {
    redraw();
    redrawCursors();
    const ro = new ResizeObserver(() => {
      redraw();
      redrawCursors();
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [redraw, redrawCursors]);

  // Re-render the canvas whenever the stroke list changes (own strokes,
  // broadcasts from others, undo, clear).
  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  // Re-render the overlay whenever presence cursors move.
  useEffect(() => {
    redrawCursors();
  }, [cursors, redrawCursors]);

  // --- Realtime (strokes + live cursor presence) ---------------------------
  useEffect(() => {
    const supabase = createClient();
    const channel: RealtimeChannel = supabase.channel(`study-room-board-${roomId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "stroke" }, ({ payload }) => {
      const s = payload as WhiteboardStroke;
      if (!s?.id || !Array.isArray(s.points)) return;
      commitStrokes((prev) => capStrokes([...prev, s]));
    });
    channel.on("broadcast", { event: "undo" }, () => {
      commitStrokes((prev) => (prev.length ? prev.slice(0, -1) : prev));
    });
    channel.on("broadcast", { event: "clear" }, () => {
      commitStrokes(() => []);
    });

    const syncCursors = () => {
      const state = channel.presenceState();
      const next = new Map<string, CursorPresence>();
      for (const key of Object.keys(state)) {
        for (const presence of state[key] as unknown as CursorPresence[]) {
          if (!presence?.user_id || presence.user_id === userId) continue;
          next.set(presence.user_id, presence);
        }
      }
      cursorsRef.current = next;
      setCursors(next);
    };

    channel
      .on("presence", { event: "sync" }, syncCursors)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, display_name: displayName, x: null, y: null });
        }
      });

    return () => {
      channelRef.current = null;
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, displayName]);

  // Throttled presence updates so a moving cursor doesn't spam realtime.
  function trackCursor(x: number, y: number) {
    const now = Date.now();
    if (now - lastCursorTrackRef.current < CURSOR_TRACK_MS) return;
    lastCursorTrackRef.current = now;
    void channelRef.current?.track({
      user_id: userId,
      display_name: displayName,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    });
  }

  function hideCursor() {
    lastCursorTrackRef.current = 0;
    void channelRef.current?.track({ user_id: userId, display_name: displayName, x: null, y: null });
  }

  function handleContainerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    trackCursor(e.clientX - rect.left, e.clientY - rect.top);
  }

  function broadcast(event: string, payload: unknown) {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event, payload });
  }

  // --- Snapshot persistence ------------------------------------------------
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        setSaving(true);
        try {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            // Offline — keep a local copy; the flush effect replays on reconnect.
            savePendingWhiteboard(roomId, strokesRef.current);
            return;
          }
          const res = await saveWhiteboard(roomId, strokesRef.current);
          if (!res.ok) {
            // Couldn't reach the server — keep a local copy rather than lose work.
            savePendingWhiteboard(roomId, strokesRef.current);
          }
        } catch {
          // Network failure — keep a local copy until we're back online.
          savePendingWhiteboard(roomId, strokesRef.current);
        } finally {
          setSaving(false);
        }
      })();
    }, 2000);
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Replay a locally-saved snapshot once the connection returns.
  const flushPendingBoard = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const pendingSnapshot = loadPendingWhiteboard(roomId);
    if (!pendingSnapshot) return;
    try {
      const res = await saveWhiteboard(roomId, pendingSnapshot.strokes);
      if (res.ok) clearPendingWhiteboard(roomId);
    } catch {
      // Still offline — retry on the next "online" event.
    }
  }, [roomId]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) void flushPendingBoard();
    const onOnline = () => void flushPendingBoard();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushPendingBoard]);

  // Track whether a snapshot is waiting locally (shared event keeps it in sync).
  useEffect(() => {
    const sync = () => setPendingOffline(loadPendingWhiteboard(roomId) !== null);
    window.addEventListener(OFFLINE_ROOM_SYNC_EVENT, sync);
    return () => window.removeEventListener(OFFLINE_ROOM_SYNC_EVENT, sync);
  }, [roomId]);

  // --- Drawing -------------------------------------------------------------
  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>): WhiteboardPoint {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * 10) / 10,
      y: Math.round((e.clientY - rect.top) * 10) / 10,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const point = canvasPoint(e);
    currentStrokeRef.current = {
      id: makeId(),
      tool,
      color,
      width,
      points: [point],
      author_id: userId,
      author_name: displayName,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const point = canvasPoint(e);
    const stroke = currentStrokeRef.current;
    const last = stroke.points[stroke.points.length - 1];
    if (last && Math.abs(last.x - point.x) < 1 && Math.abs(last.y - point.y) < 1) return;
    stroke.points.push(point);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStrokeSegment(ctx, stroke, strokeRenderColor(stroke, byPersonRef.current));
  }

  function handlePointerUp() {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke.points.length === 0) return;
    // Single tap with no movement still renders a dot.
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      stroke.points.push({ x: p.x + 0.01, y: p.y + 0.01 });
    }
    commitStrokes((prev) => capStrokes([...prev, stroke]));
    broadcast("stroke", stroke);
    scheduleSave();
    void hapticLight();
  }

  function toggleByPerson() {
    setByPerson((prev) => {
      byPersonRef.current = !prev;
      return !prev;
    });
  }

  function handleUndo() {
    if (readOnly || strokesRef.current.length === 0) return;
    commitStrokes((prev) => prev.slice(0, -1));
    broadcast("undo", {});
    scheduleSave();
  }

  async function handleClear() {
    if (readOnly || strokesRef.current.length === 0) return;
    if (!window.confirm("Clear the whole whiteboard for everyone?")) return;
    commitStrokes(() => []);
    broadcast("clear", {});
    await clearWhiteboard(roomId);
  }

  /** Render the current strokes to an offscreen canvas and return a PNG data URL. */
  function renderBoardPng(): string | null {
    const container = containerRef.current;
    if (!container) return null;
    const cssW = Math.max(1, container.clientWidth);
    const cssH = Math.max(1, container.clientHeight || 480);
    // Export at 2x for crispness when pinned/shared, capped for size.
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(2400, Math.round(cssW * scale));
    canvas.height = Math.min(2400, Math.round(cssH * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const s = canvas.width / cssW;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      ctx.beginPath();
      // Eraser leaves white (opaque) rather than transparent — PNG needs a solid bg.
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "source-over" : "source-over";
      ctx.strokeStyle =
        stroke.tool === "eraser" ? "#ffffff" : strokeRenderColor(stroke, byPersonRef.current);
      ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 2.5 : stroke.width;
      if (stroke.points.length === 0) continue;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    return canvas.toDataURL("image/png");
  }

  function handleDownload() {
    const dataUrl = renderBoardPng();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `whiteboard-${roomId.slice(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    void hapticLight();
  }

  async function handlePin() {
    if (!spaceSlug) return;
    const dataUrl = renderBoardPng();
    if (!dataUrl) {
      toast.error("Couldn't render the board.");
      return;
    }
    setPinning(true);
    try {
      const result = await pinWhiteboardToSpace(roomId, spaceSlug, dataUrl, roomName ?? "");
      if (result.ok) {
        toast.success("Board pinned to the community.");
      } else {
        toast.error(result.error ?? "Couldn't pin the board.");
      }
    } catch {
      toast.error("Couldn't pin the board.");
    } finally {
      setPinning(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant={tool === "pen" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setTool("pen")}
            disabled={readOnly}
          >
            <PenLine className="h-3.5 w-3.5" /> Pen
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setTool("eraser")}
            disabled={readOnly}
          >
            <Eraser className="h-3.5 w-3.5" /> Eraser
          </Button>
          <Button
            variant={byPerson ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={toggleByPerson}
            title={
              byPerson
                ? "Per-person colors — each author's strokes match their cursor. Click to pick your own color."
                : "Pick your own color. Click for per-person colors."
            }
          >
            <Palette className="h-3.5 w-3.5" /> Person
          </Button>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              disabled={readOnly || tool !== "pen" || byPerson}
              onClick={() => setColor(c)}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                color === c && tool === "pen" && !byPerson
                  ? "border-foreground"
                  : "border-transparent",
                byPerson && "opacity-40",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={`Stroke width ${w}`}
              disabled={readOnly}
              onClick={() => setWidth(w)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent",
                width === w && "bg-accent",
              )}
            >
              <span
                className="rounded-full bg-foreground"
                style={{ width: Math.min(w + 2, 12), height: Math.min(w + 2, 12) }}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">
            {strokes.length} stroke{strokes.length === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
            disabled={strokes.length === 0}
            title="Download as PNG"
          >
            <Download className="h-4 w-4" />
          </Button>
          {spaceSlug && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePin}
              disabled={pinning || strokes.length === 0}
              title="Pin to community"
            >
              {pinning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleUndo}
            disabled={readOnly || strokes.length === 0}
            title="Undo last stroke"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={handleClear}
            disabled={readOnly || strokes.length === 0}
            title="Clear board"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <span className="h-4 w-4" aria-hidden />
          )}
          {pendingOffline && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400"
              title="You're offline — changes are saved on this device and will sync when you reconnect."
            >
              <CloudOff className="h-3 w-3" />
              Saved locally
            </span>
          )}
        </div>
      </div>
      {byPerson && (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Who drew what
          </span>
          {authors.length === 0 ? (
            <span className="text-xs text-muted-foreground">Draw to see per-person colors.</span>
          ) : (
            authors.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 text-xs">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: cursorColor(a.id) }}
                />
                {a.name || "Unknown"}
                {a.id === userId ? " (you)" : ""}
              </span>
            ))
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="relative min-h-[320px] flex-1 touch-none"
        onPointerMove={handleContainerPointerMove}
        onPointerLeave={hideCursor}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {/* Live presence cursors for other people in the room */}
        <canvas ref={cursorCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {readOnly && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/40 text-sm text-muted-foreground">
            This room has ended — board is read-only.
          </div>
        )}
      </div>
    </div>
  );
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke, color: string) {
  ctx.beginPath();
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#000000" : color;
  ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 2.5 : stroke.width;
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

/** Match a canvas to its container size (device-pixel-ratio aware). */
function sizeCanvas(canvas: HTMLCanvasElement, container: HTMLElement): number {
  const dpr = window.devicePixelRatio || 1;
  const cssW = container.clientWidth;
  const cssH = Math.max(320, container.clientHeight);
  if (canvas.width !== Math.floor(cssW * dpr)) {
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
  }
  return dpr;
}

/** Draw one presence cursor (dot + name pill) on the overlay canvas. */
function drawCursor(ctx: CanvasRenderingContext2D, dpr: number, cursor: CursorPresence) {
  const x = cursor.x ?? 0;
  const y = cursor.y ?? 0;
  const color = cursorColor(cursor.user_id);
  const name = cursor.display_name;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Pointer dot
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Name pill above-right of the dot
  ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
  const w = Math.round(ctx.measureText(name).width) + 14;
  const px = x + 8;
  const py = y - 26;
  const h = 18;
  const r = 5;
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + w, py, px + w, py + h, r);
  ctx.arcTo(px + w, py + h, px, py + h, r);
  ctx.arcTo(px, py + h, px, py, r);
  ctx.arcTo(px, py, px + w, py, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(name, px + 7, py + h / 2);
  ctx.textBaseline = "alphabetic";
}

/** Incremental version used while the pointer is moving (cheaper than a full redraw). */
function drawStrokeSegment(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke, color: string) {
  ctx.beginPath();
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#000000" : color;
  ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 2.5 : stroke.width;
  const pts = stroke.points;
  const from = pts.length >= 2 ? pts[pts.length - 2] : pts[0];
  const to = pts[pts.length - 1];
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}
