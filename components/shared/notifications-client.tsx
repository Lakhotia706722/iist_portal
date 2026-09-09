"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, cn } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";

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

export function NotificationsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications-page", unreadOnly],
    queryFn: async () => {
      const res = await fetch(`/api/notifications?limit=50&unreadOnly=${unreadOnly}`);
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json() as Promise<{
        notifications: Notification[];
        unreadCount: number;
        total: number;
      }>;
    },
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
      qc.invalidateQueries({ queryKey: ["notifications-page"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      if (vars.all) toast({ title: "All notifications marked read", variant: "success" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState text="Loading notifications…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = data?.notifications ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data?.unreadCount ?? 0} unread of {data?.total ?? 0}
        </p>
        <div className="flex gap-2">
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setUnreadOnly((v) => !v)}
          >
            Unread only
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(data?.unreadCount ?? 0) === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true })}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? "Nothing unread" : "No notifications yet"}
          description="Updates about your applications, tests, interviews and documents appear here."
        />
      ) : (
        <Card className="divide-y p-0">
          {items.map((n) => {
            const body = (
              <div
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50",
                  !n.readAt && "bg-primary/5"
                )}
              >
                {!n.readAt ? (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                ) : (
                  <span className="mt-2 h-2 w-2 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.subject}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                <StatusBadge status={n.category.toUpperCase()} label={n.category} />
              </div>
            );
            return (
              <div key={n.id}>
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => !n.readAt && markRead.mutate({ id: n.id })}
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
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
