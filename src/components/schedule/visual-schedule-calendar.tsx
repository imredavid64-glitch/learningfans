"use client";

import { useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ListFilter,
  Plus,
  Clock,
  Trash2,
  Users,
} from "lucide-react";
import { deleteEvent, rsvpToEvent } from "@/actions/schedule";

export interface ScheduleEvent {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  visibility: string;
  space_id?: string | null;
  spaceName?: string;
}

interface VisualScheduleCalendarProps {
  personalEvents: ScheduleEvent[];
  sharedEvents: ScheduleEvent[];
  onSelectDateToAdd?: (dateStr: string) => void;
}

export function VisualScheduleCalendar({
  personalEvents,
  sharedEvents,
  onSelectDateToAdd,
}: VisualScheduleCalendarProps) {
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);

  const allEvents = [
    ...personalEvents.map((e) => ({ ...e, isPersonal: true })),
    ...sharedEvents.map((e) => ({ ...e, isPersonal: false })),
  ];

  // Month navigation
  const handlePrev = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  // Generate days for Month View
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Generate days for Week View
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(weekStart);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Filter events for a given day
  const getEventsForDay = (day: Date) => {
    return allEvents.filter((event) => {
      try {
        const eventDate = parseISO(event.starts_at);
        return isSameDay(eventDate, day);
      } catch {
        return false;
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Bar Navigation & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev} title="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext} title="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 font-semibold text-lg text-foreground">
            {viewMode === "week"
              ? `Week of ${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
              : format(currentDate, "MMMM yyyy")}
          </h2>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <Button
            variant={viewMode === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("month")}
            className="h-8 text-xs"
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" /> Month
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("week")}
            className="h-8 text-xs"
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" /> Week
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 text-xs"
          >
            <ListFilter className="mr-1.5 h-3.5 w-3.5" /> List
          </Button>
        </div>
      </div>

      {/* Visual Month View */}
      {viewMode === "month" && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-2.5">
                {day}
              </div>
            ))}
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 border-t border-l">
            {monthDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const inCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`group relative min-h-[110px] border-b border-r p-1.5 transition-colors ${
                    !inCurrentMonth ? "bg-muted/20 text-muted-foreground" : "bg-card"
                  } ${isCurrentDay ? "bg-primary/5 font-semibold" : ""}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                        isCurrentDay ? "bg-primary text-primary-foreground font-bold" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </span>

                    {onSelectDateToAdd && (
                      <button
                        onClick={() => onSelectDateToAdd(format(day, "yyyy-MM-dd'T'10:00"))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Add event on this date"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Events list in cell */}
                  <div className="mt-1.5 space-y-1 overflow-y-auto max-h-[80px]">
                    {dayEvents.map((evt) => (
                      <button
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-all ${
                          evt.isPersonal
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25"
                            : "bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-500/25"
                        }`}
                      >
                        {format(parseISO(evt.starts_at), "h:mma")} {evt.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Week View */}
      {viewMode === "week" && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`py-2 border-r last:border-r-0 ${
                  isToday(day) ? "bg-primary/10 text-primary font-bold" : ""
                }`}
              >
                <div>{format(day, "EEE")}</div>
                <div className="text-sm font-semibold">{format(day, "MMM d")}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 min-h-[350px]">
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`border-r p-2 space-y-2 last:border-r-0 ${
                    isToday(day) ? "bg-primary/5" : ""
                  }`}
                >
                  {dayEvents.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">No events</div>
                  ) : (
                    dayEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`cursor-pointer rounded-lg p-2 text-xs shadow-xs border transition-all hover:scale-[1.02] ${
                          evt.isPersonal
                            ? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
                            : "border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-200"
                        }`}
                      >
                        <div className="font-semibold truncate">{evt.title}</div>
                        <div className="text-[10px] opacity-80 mt-0.5">
                          {format(parseISO(evt.starts_at), "h:mm a")} -{" "}
                          {format(parseISO(evt.ends_at), "h:mm a")}
                        </div>
                        {evt.spaceName && (
                          <div className="text-[10px] font-medium text-purple-600 dark:text-purple-400 mt-1">
                            📚 {evt.spaceName}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed View Modal / Drawer for Selected Event */}
      {selectedEvent && (
        <Card className="border-2 border-primary/30 shadow-lg animate-in fade-in slide-in-from-top-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{selectedEvent.title}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {format(parseISO(selectedEvent.starts_at), "EEEE, MMM d, yyyy · h:mm a")} -{" "}
                  {format(parseISO(selectedEvent.ends_at), "h:mm a")}
                </div>
              </div>
              <Badge variant={selectedEvent.visibility === "private" ? "outline" : "secondary"}>
                {selectedEvent.visibility === "private" ? "Personal" : "Shared Space"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedEvent.description && (
              <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
            )}

            {selectedEvent.spaceName && (
              <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
                <Users className="h-3.5 w-3.5" />
                Class / Space: {selectedEvent.spaceName}
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>

              <div className="flex items-center gap-2">
                {selectedEvent.visibility === "private" ? (
                  <form action={deleteEvent.bind(null, selectedEvent.id)}>
                    <Button type="submit" variant="destructive" size="sm" className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> Delete Event
                    </Button>
                  </form>
                ) : (
                  <div className="flex gap-2">
                    <form action={rsvpToEvent.bind(null, selectedEvent.id, "going")}>
                      <Button type="submit" size="sm" variant="secondary">
                        RSVP Going
                      </Button>
                    </form>
                    <form action={rsvpToEvent.bind(null, selectedEvent.id, "maybe")}>
                      <Button type="submit" size="sm" variant="outline">
                        RSVP Maybe
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
