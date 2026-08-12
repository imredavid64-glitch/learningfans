"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { saveWhiteboard, clearWhiteboard } from "@/actions/study-rooms";
import {
  capStrokes,
  isValidWhiteboard,
  type WhiteboardPoint,
  type WhiteboardStroke,
} from "@/lib/study-room-utils";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import {
  Eraser,
  PenLine,
  Trash2,
  Undo2,
  Loader2,
} from "lucide-react";

const COLORS = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#9333ea", "#ea580c"];
const WIDTHS = [2, 5, 10, 18];

interface WhiteboardProps {
  roomId: string;
  initialStrokes: unknown;
  readOnly?: boolean;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function Whiteboard({ roomId, initialStrokes, readOnly }: WhiteboardProps) {
  function initStrokes(): WhiteboardStroke[] {
    return isValidWhiteboard(initialStrokes) ? initialStrokes : [];
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<WhiteboardStroke[]>(initStrokes());
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>(initStrokes);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [saving, setSaving] = useState(false);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

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
    const dpr = window.devicePixelRatio || 1;
    const cssW = container.clientWidth;
    const cssH = Math.max(320, container.clientHeight);
    if (canvas.width !== Math.floor(cssW * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokesRef.current) {
      drawStroke(ctx, s);
    }
  }, []);

  useEffect(() => {
    redraw();
    const ro = new ResizeObserver(() => redraw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [redraw]);

  // Re-render the canvas whenever the stroke list changes (own strokes,
  // broadcasts from others, undo, clear).
  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  // --- Realtime ------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient();
    const channel: RealtimeChannel = supabase.channel(`study-room-board-${roomId}`);
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
    channel.subscribe();

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

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
        await saveWhiteboard(roomId, strokesRef.current);
        setSaving(false);
      })();
    }, 2000);
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
    drawStrokeSegment(ctx, stroke);
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
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              disabled={readOnly || tool !== "pen"}
              onClick={() => setColor(c)}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                color === c && tool === "pen" ? "border-foreground" : "border-transparent",
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
        </div>
      </div>
      <div ref={containerRef} className="relative min-h-[320px] flex-1 touch-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {readOnly && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/40 text-sm text-muted-foreground">
            This room has ended — board is read-only.
          </div>
        )}
      </div>
    </div>
  );
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) {
  ctx.beginPath();
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#000000" : stroke.color;
  ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 2.5 : stroke.width;
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

/** Incremental version used while the pointer is moving (cheaper than a full redraw). */
function drawStrokeSegment(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) {
  ctx.beginPath();
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#000000" : stroke.color;
  ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 2.5 : stroke.width;
  const pts = stroke.points;
  const from = pts.length >= 2 ? pts[pts.length - 2] : pts[0];
  const to = pts[pts.length - 1];
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}
