"use client";

import { useState } from "react";
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json() as Promise<InboxResponse>;
    },
    // Keep the badge roughly current without hammering the API.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

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
      if (vars.all) {
        toast({ title: "All notifications marked read", variant: "success" });
      }
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const unread = data?.unreadCount ?? 0;
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
