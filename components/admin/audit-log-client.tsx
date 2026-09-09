"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/utils";
import { ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
};

export function AuditLogClient() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const pageSize = 30;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", search, action, entity, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
      if (search) qs.set("search", search);
      if (action) qs.set("action", action);
      if (entity) qs.set("entity", entity);
      const res = await fetch(`/api/admin/audit-logs?${qs}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      return res.json() as Promise<{ logs: AuditLog[]; total: number; entities: string[]; actions: string[] }>;
    },
  });

  if (isLoading) return <LoadingState text="Loading audit logs…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search actor, entity, or entity ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            aria-label="Search audit logs"
          />
        </div>
        <Select aria-label="Filter by action" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} className="w-40">
          <option value="">All actions</option>
          {(data?.actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select aria-label="Filter by entity" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }} className="w-48">
          <option value="">All entities</option>
          {(data?.entities ?? []).map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No matching audit entries" description="Adjust the filters above." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>
                      {log.user ? (
                        <>
                          <div className="text-sm font-medium">{log.user.name}</div>
                          <div className="text-xs text-muted-foreground">{log.user.role}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={log.action} /></TableCell>
                    <TableCell className="text-sm">{log.entity}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">{log.entityId ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setDetail(log)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit entry — {detail?.entity}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">When:</span> {formatDateTime(detail.createdAt)}</div>
                <div><span className="text-muted-foreground">Action:</span> <StatusBadge status={detail.action} /></div>
                <div><span className="text-muted-foreground">Actor:</span> {detail.user?.name ?? "System"} ({detail.user?.email ?? "—"})</div>
                <div><span className="text-muted-foreground">IP:</span> {detail.ipAddress ?? "—"}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-medium">Before</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {detail.oldValues ? JSON.stringify(detail.oldValues, null, 2) : "—"}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-medium">After</p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {detail.newValues ? JSON.stringify(detail.newValues, null, 2) : "—"}
                  </pre>
                </div>
              </div>
              {!!detail.metadata && (
                <div>
                  <p className="mb-1 font-medium">Metadata</p>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(detail.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
