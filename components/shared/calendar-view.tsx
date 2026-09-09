"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NativeSelect as Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge, formatStatusLabel } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Video } from "lucide-react";

export type CalendarItem = {
  id: string;
  source: string;
  type: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  venue?: string | null;
  meetingLink?: string | null;
  link?: string | null;
};

const TYPE_TONE: Record<string, string> = {
  APPLICATION_DEADLINE: "border-l-red-500",
  DOCUMENT_DEADLINE: "border-l-red-500",
  PRE_PLACEMENT_TALK: "border-l-violet-500",
  SKILLUP_TEST: "border-l-blue-500",
  MOCK_INTERVIEW: "border-l-amber-500",
  TECHNICAL_INTERVIEW: "border-l-emerald-500",
  HR_INTERVIEW: "border-l-emerald-500",
  APTITUDE_TEST: "border-l-blue-500",
  CODING_TEST: "border-l-blue-500",
  DRIVE_VISIT: "border-l-slate-500",
};

function monthBounds(d: Date) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  return { from, to };
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarView({
  endpoint,
  emptyDescription,
}: {
  endpoint: string;
  emptyDescription: string;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [typeFilter, setTypeFilter] = useState("");
  const [view, setView] = useState<"month" | "list">("month");

  const { from, to } = useMemo(() => monthBounds(cursor), [cursor]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["calendar", endpoint, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      const res = await fetch(`${endpoint}?${qs}`);
      if (!res.ok) throw new Error("Failed to load the calendar");
      return res.json() as Promise<{ events: CalendarItem[] }>;
    },
  });

  const events = useMemo(() => {
    const all = data?.events ?? [];
    return typeFilter ? all.filter((e) => e.type === typeFilter) : all;
  }, [data, typeFilter]);

  const types = useMemo(
    () => [...new Set((data?.events ?? []).map((e) => e.type))].sort(),
    [data]
  );

  // Weeks grid for the month view (Monday-first).
  const weeks = useMemo(() => {
    const first = new Date(from);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    return Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [from]);

  if (isLoading) return <LoadingState text="Loading calendar…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-semibold">
            {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by event type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-52"
          >
            <option value="">All event types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {formatStatusLabel(t)}
              </option>
            ))}
          </Select>
          <div className="flex rounded-lg border p-0.5">
            {(["month", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm capitalize transition-colors",
                  view === v ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled this month"
          description={emptyDescription}
        />
      ) : view === "list" ? (
        <Card className="divide-y p-0">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </Card>
      ) : (
        <Card className="overflow-x-auto p-2">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div
                  key={d}
                  className="px-2 py-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weeks.flat().map((day, i) => {
                const inMonth = day.getMonth() === cursor.getMonth();
                const dayEvents = events.filter((e) => sameDay(new Date(e.startAt), day));
                const isToday = sameDay(day, new Date());
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[92px] rounded-lg border p-1.5",
                      !inMonth && "bg-muted/30 text-muted-foreground/50",
                      isToday && "border-primary"
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1 text-xs font-medium",
                        isToday && "text-primary"
                      )}
                    >
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <EventChip key={e.id} event={e} />
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="px-1 text-[10px] text-muted-foreground">
                          +{dayEvents.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function EventChip({ event }: { event: CalendarItem }) {
  const time = new Date(event.startAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const content = (
    <div
      className={cn(
        "truncate rounded border-l-2 bg-muted/60 px-1 py-0.5 text-[10px] leading-tight",
        TYPE_TONE[event.type] ?? "border-l-slate-400"
      )}
      title={`${time} · ${event.title}`}
    >
      <span className="font-medium">{time}</span> {event.title}
    </div>
  );
  return event.link ? <Link href={event.link}>{content}</Link> : content;
}

function EventRow({ event }: { event: CalendarItem }) {
  const start = new Date(event.startAt);
  const body = (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-accent/50",
        TYPE_TONE[event.type] ?? "border-l-slate-400"
      )}
    >
      <div className="w-28 shrink-0">
        <p className="text-sm font-semibold">
          {start.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </p>
        <p className="text-xs text-muted-foreground">
          {start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{event.title}</p>
        {event.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {event.description}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {event.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.venue}
            </span>
          )}
          {event.meetingLink && (
            <span className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              Online
            </span>
          )}
        </div>
      </div>
      <StatusBadge status={event.type} />
    </div>
  );
  return event.link ? <Link href={event.link}>{body}</Link> : body;
}
