"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  subject: string;
  message: string;
  category: string;
  entityType: string | null;
  priority: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type InboxResponse = {
  notifications: Notification[];
  unreadCount: number;
  total: number;
};

/**
 * Phase 15 Step 3 — the notification-triggered fast path. Every
 * PlacementNotifications.* / AdminNotifications.* call already tags its
 * row with `entityType` (drive/application/round/offer/document) — this
 * maps that straight onto the query-key prefixes the "live" queries this
 * phase wired up actually use, so a fresh notification of a given type
 * invalidates exactly what it relates to, across whichever role happens to
 * be viewing (invalidating a query key that role doesn't have cached is a
 * harmless no-op — this map isn't role-specific on purpose, since the bell
 * itself is shared by all 5 roles).
 */
const ENTITY_QUERY_KEYS: Record<string, string[]> = {
  drive: ["student-opportunities", "faculty-drives"],
  application: [
    "student-applications",
    "student-applications-journey",
    "drive-applications",
    "drive-shortlist",
    "all-applications",
    "shortlisting-queue",
    "hod-applications",
    "admin-students-directory",
  ],
  round: [
    "student-applications-journey",
    "round-attendance",
    "attendance-overview",
    "rounds-overview",
  ],
  offer: ["student-offers", "admin-offers", "hod-offers", "hod-dashboard", "command-center"],
  document: ["student-documents", "compliance"],
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type PeekResponse = { unreadCount: number; latestId: string | null };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  // Phase 16 — P3.1: the bell's own poll is the highest-frequency "live"
  // query in the app (8s, since it's also the fast-path trigger) — at
  // 1000+ concurrent users, re-fetching and re-serializing up to 15 full
  // notification rows every 8s per user is real, avoidable load. This
  // cheap peek (one indexed count + one indexed single-row lookup, no
  // notification bodies) runs on that tight interval instead; the
  // expensive full list below is fetched only when something actually
  // changed (or the dropdown opens), not on a timer.
  const { data: peek } = useQuery({
    queryKey: ["notifications-peek"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/peek");
      if (!res.ok) throw new Error("Failed to check notifications");
      return res.json() as Promise<PeekResponse>;
    },
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const { data, isLoading, refetch: refetchList } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json() as Promise<InboxResponse>;
    },
    // Not on its own timer any more — triggered explicitly (below) when
    // peek detects something new, or when the dropdown is opened.
    enabled: false,
  });

  // Phase 15 Step 3 — fast-path invalidation, now driven by peek() instead
  // of the bell's own poll. Diffs each peek's latestId against the last
  // one seen; a genuine change fetches the full list (for entityType) and
  // invalidates the query it relates to, rather than waiting for that
  // query's own independent (slower) poll cycle. The very first peek
  // populates the seen id without treating it as "new".
  const lastSeenId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!peek) return;
    if (lastSeenId.current === undefined) {
      lastSeenId.current = peek.latestId;
      // Populate the dropdown's data once on mount so opening it later
      // doesn't show a blank loading state for no reason.
      refetchList();
      return;
    }
    if (peek.latestId === lastSeenId.current) return;
    lastSeenId.current = peek.latestId;
    refetchList();
  }, [peek, refetchList]);

  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const currentIds = new Set(data.notifications.map((n) => n.id));
    if (seenIds.current === null) {
      seenIds.current = currentIds;
      return;
    }
    const freshlyArrived = data.notifications.filter((n) => !seenIds.current!.has(n.id));
    seenIds.current = currentIds;
    if (freshlyArrived.length === 0) return;

    const keysToInvalidate = new Set<string>();
    for (const n of freshlyArrived) {
      const keys = (n.entityType && ENTITY_QUERY_KEYS[n.entityType]) || [];
      keys.forEach((k) => keysToInvalidate.add(k));
    }
    keysToInvalidate.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  }, [data, qc]);

  // Opening the dropdown before the first peek-triggered fetch landed
  // (or if it somehow missed one) should never show stale/empty content.
  useEffect(() => {
    if (open && !data) refetchList();
  }, [open, data, refetchList]);

  const markRead = useMutation({
    mutationFn: async (body: { id?: string; all?: boolean }) => {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Could not update notification");
      return res.json();
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-peek"] });
      if (vars.all) {
        toast({ title: "All notifications marked read", variant: "success" });
      }
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // Prefer peek's count — it's refreshed every 8s regardless of whether
  // the full list has been fetched yet; data?.unreadCount is a fallback
  // for the brief window before the first peek response lands.
  const unread = peek?.unreadCount ?? data?.unreadCount ?? 0;
  const items = data?.notifications ?? [];

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border bg-popover shadow-lg sm:w-96">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button
                  onClick={() => markRead.mutate({ all: true })}
                  disabled={markRead.isPending}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  You have no notifications yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {items.map((n) => {
                    const body = (
                      <div
                        className={cn(
                          "px-3 py-2.5 transition-colors hover:bg-accent/60",
                          !n.readAt && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {!n.readAt && (
                            <span
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                              aria-label="Unread"
                            />
                          )}
                          <div className={cn("min-w-0 flex-1", n.readAt && "pl-4")}>
                            <p className="truncate text-sm font-medium">{n.subject}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {n.message}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground/70">
                              {timeAgo(n.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );

                    return (
                      <li key={n.id}>
                        {n.link ? (
                          <Link
                            href={n.link}
                            onClick={() => {
                              if (!n.readAt) markRead.mutate({ id: n.id });
                              setOpen(false);
                            }}
                            className="block"
                          >
                            {body}
                          </Link>
                        ) : (
                          <button
                            className="block w-full text-left"
                            onClick={() => !n.readAt && markRead.mutate({ id: n.id })}
                          >
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t px-3 py-2">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-primary hover:underline"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
