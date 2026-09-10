"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchJson } from "@/lib/api-client";
import { roundsOverviewResponseSchema } from "@/lib/validations/responses";
import { Search, Layers } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

/**
 * Phase 12 — Admin's "Rounds" nav item. A cross-drive queue of every
 * placement round with a link into its drive's own Rounds tab, which is
 * where scheduling/editing/participant management already lives (built and
 * tested in Phase 9-10) — this page's job is finding a round, not
 * reimplementing round management a second time.
 */
export function RoundsOverviewClient() {
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  const fetchRounds = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const p = new URLSearchParams({ limit: "100" });
      if (search) p.set("search", search);
      const data = await fetchJson(`/api/admin/rounds?${p}`, roundsOverviewResponseSchema);
      setRounds(data.rounds);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchRounds(); }, [fetchRounds]);

  if (loading) return <LoadingState text="Loading rounds…" />;
  if (error) return <ErrorState onRetry={fetchRounds} />;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search rounds or drives" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search rounds" />
      </div>

      {rounds.length === 0 ? (
        <EmptyState icon={Layers} title="No rounds found" description="Placement rounds will appear here once scheduled." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-left font-medium">Round</th>
                  <th className="p-3 text-left font-medium">Drive</th>
                  <th className="p-3 text-left font-medium">Mode</th>
                  <th className="p-3 text-left font-medium">Scheduled</th>
                  <th className="p-3 text-left font-medium">Participants</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.type}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.drive.title}
                      <div className="text-xs">{r.drive.company.name}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.mode}{r.venue ? ` · ${r.venue}` : ""}</td>
                    <td className="p-3 text-muted-foreground">{r.scheduledAt ? formatDateTime(r.scheduledAt) : "Not scheduled"}</td>
                    <td className="p-3 tabular-nums">{r.participantCount}</td>
                    <td className="p-3"><Badge variant={r.isCompleted ? "success" : "secondary"}>{r.isCompleted ? "Completed" : "Pending"}</Badge></td>
                    <td className="p-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/drives/${r.drive.id}`}>View drive</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
