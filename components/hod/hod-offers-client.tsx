"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchJson } from "@/lib/api-client";
import { hodOffersResponseSchema } from "@/lib/validations/responses";
import { Search, Award } from "lucide-react";

/** Phase 12 — department-scoped offers for the HOD portal. */
export function HodOffersClient() {
  const [search, setSearch] = useState("");

  // Live — Phase 15: an admin recording/accepting an offer for a
  // department student.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hod-offers", search],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100" });
      if (search) p.set("search", search);
      return fetchJson(`/api/hod/offers?${p}`, hodOffersResponseSchema);
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const offers = data?.offers ?? [];

  if (isLoading) return <LoadingState text="Loading offers…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search offers" />
      </div>

      {offers.length === 0 ? (
        <EmptyState icon={Award} title="No offers yet" description="Offers made to your department's students will appear here." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-left font-medium">Student</th>
                  <th className="p-3 text-left font-medium">Company / Role</th>
                  <th className="p-3 text-left font-medium">CTC</th>
                  <th className="p-3 text-left font-medium">Stipend</th>
                  <th className="p-3 text-left font-medium">Offer Date</th>
                  <th className="p-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-medium">{[o.student.firstName, o.student.lastName].filter(Boolean).join(" ") || o.student.enrollmentNumber}</p>
                      <p className="text-xs text-muted-foreground">{o.student.enrollmentNumber} · {o.student.batch.branch.code}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {o.company.name}
                      <div className="text-xs">{o.jobRole.title}</div>
                    </td>
                    <td className="p-3 font-mono">{o.ctc != null ? `₹${o.ctc.toLocaleString("en-IN")}` : "—"}</td>
                    <td className="p-3 font-mono">{o.stipend != null ? `₹${o.stipend.toLocaleString("en-IN")}` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{new Date(o.offerDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="p-3"><StatusBadge status={o.status} className="text-xs" /></td>
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
