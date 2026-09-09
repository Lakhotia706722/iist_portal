"use client";

import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Offer {
  id: string;
  status: string;
  ctc: number | null;
  stipend: number | null;
  offerDate: string;
  student: { firstName: string | null; lastName: string | null; enrollmentNumber: string };
  jobRole: { title: string };
  drive: { title: string };
}

const NEXT_STATUS: Record<string, string[]> = {
  OFFERED: ["ACCEPTED", "DECLINED", "WITHDRAWN"],
  ACCEPTED: ["JOINED", "WITHDRAWN", "DECLINED"],
};

export function CompanyOffersClient() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["company-offers"],
    queryFn: async () => {
      const res = await fetch("/api/company/offers");
      if (!res.ok) throw new Error("Failed to load offers");
      return res.json() as Promise<{ offers: Offer[] }>;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/company/offers/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update offer");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Offer updated" });
      queryClient.invalidateQueries({ queryKey: ["company-offers"] });
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState text="Loading offers…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (data!.offers.length === 0) return <EmptyState icon={Award} title="No offers yet" description="Offers recorded against your drives will show up here." />;

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>CTC / Stipend</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data!.offers.map((o) => {
              const name = [o.student.firstName, o.student.lastName].filter(Boolean).join(" ") || o.student.enrollmentNumber;
              const nextOptions = NEXT_STATUS[o.status] ?? [];
              return (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">{o.student.enrollmentNumber}</div>
                  </TableCell>
                  <TableCell>{o.jobRole.title}</TableCell>
                  <TableCell>{o.ctc != null ? `${o.ctc} LPA` : o.stipend != null ? `${o.stipend}/mo` : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {nextOptions.map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant="outline"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: o.id, status: next })}
                        >
                          Mark {next.charAt(0) + next.slice(1).toLowerCase()}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
