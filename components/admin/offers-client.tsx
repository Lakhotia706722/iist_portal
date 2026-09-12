"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge, formatStatusLabel } from "@/components/shared/status-badge";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Award, Upload, FileText, Plus } from "lucide-react";
import {
  OFFER_STATUSES,
  OFFER_CATEGORIES,
  OFFER_TYPES,
} from "@/lib/validations/offer";

type Offer = {
  id: string;
  status: string;
  type: string;
  category: string;
  isPPO: boolean;
  ctc: number | null;
  stipend: number | null;
  location: string | null;
  offerDate: string;
  joiningDate: string | null;
  offerLetterKey: string | null;
  student: {
    id: string;
    enrollmentNumber: string;
    firstName: string | null;
    lastName: string | null;
    branch: { code: string } | null;
  };
  company: { id: string; name: string };
  jobRole: { id: string; title: string };
  drive: { id: string; title: string; academicYear: string };
};

type OfferStats = {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  ctc: {
    average: number | null;
    highest: number | null;
    lowest: number | null;
    countWithCtc: number;
  };
};

/** Next statuses an offer may legally move to — mirrors the server rules. */
const NEXT_STATUSES: Record<string, string[]> = {
  OFFERED: ["ACCEPTED", "DECLINED", "WITHDRAWN"],
  ACCEPTED: ["JOINED", "WITHDRAWN", "DECLINED"],
  DECLINED: [],
  JOINED: [],
  WITHDRAWN: [],
};

type OfferableApplication = {
  id: string;
  student: {
    enrollmentNumber: string;
    firstName: string | null;
    lastName: string | null;
    branch: { code: string } | null;
  };
  jobRole: {
    title: string;
    ctcMin: number | null;
    ctcMax: number | null;
    drive: { academicYear: string; company: { name: string } };
  };
};

const EMPTY_FORM = {
  applicationId: "",
  category: "NON_CORE",
  type: "FULL_TIME",
  isPPO: false,
  ctc: "",
  stipend: "",
  ctcBreakdown: "",
  location: "",
  offerDate: new Date().toISOString().slice(0, 10),
  joiningDate: "",
};

async function fetchOfferable() {
  const res = await fetch("/api/admin/offers/offerable-applications");
  if (!res.ok) throw new Error("Failed to load selected applications");
  return res.json() as Promise<{ applications: OfferableApplication[] }>;
}

async function fetchOffers(params: { status: string; category: string }) {
  const qs = new URLSearchParams({
    includeStats: "true",
    limit: "50",
    ...(params.status ? { status: params.status } : {}),
    ...(params.category ? { category: params.category } : {}),
  });
  const res = await fetch(`/api/admin/offers?${qs}`);
  if (!res.ok) throw new Error("Failed to load offers");
  return res.json() as Promise<{ offers: Offer[]; stats: OfferStats | null }>;
}

function studentName(s: Offer["student"]) {
  const name = [s.firstName, s.lastName].filter(Boolean).join(" ");
  return name || s.enrollmentNumber;
}

export function OffersClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [statusTarget, setStatusTarget] = useState<Offer | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  const [letterTarget, setLetterTarget] = useState<Offer | null>(null);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // Live — Phase 15: another admin, or a company rep accepting/declining
  // via their own portal, can change offer status concurrently.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-offers", status, category],
    queryFn: () => fetchOffers({ status, category }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const { data: offerable } = useQuery({
    queryKey: ["offerable-applications"],
    queryFn: fetchOfferable,
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: form.applicationId,
          category: form.category,
          type: form.type,
          isPPO: form.isPPO,
          ctc: form.ctc ? Number(form.ctc) : null,
          stipend: form.stipend ? Number(form.stipend) : null,
          ctcBreakdown: form.ctcBreakdown || null,
          location: form.location || null,
          offerDate: form.offerDate,
          joiningDate: form.joiningDate || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          body.error ??
            Object.values(body.fieldErrors ?? {})[0] ??
            "Failed to record offer"
        );
      }
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Offer recorded",
        description: "The offer has been added to the student's placement history.",
        variant: "success",
      });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      qc.invalidateQueries({ queryKey: ["offerable-applications"] });
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast({ title: "Could not record offer", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (vars: { id: string; status: string; note: string }) => {
      const res = await fetch(`/api/admin/offers/${vars.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: vars.status, note: vars.note || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update status");
      return body;
    },
    onSuccess: (_res, vars) => {
      toast({
        title: "Offer updated",
        description: `Offer marked ${formatStatusLabel(vars.status)}.`,
        variant: "success",
      });
      setStatusTarget(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
    },
    onError: (err: Error) =>
      toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const letterMutation = useMutation({
    mutationFn: async (vars: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", vars.file);
      const res = await fetch(`/api/admin/offers/${vars.id}/letter`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Offer letter uploaded",
        description: "The document is now attached to this offer.",
        variant: "success",
      });
      setLetterTarget(null);
      setLetterFile(null);
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
    },
    onError: (err: Error) =>
      toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState text="Loading offers…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const offers = data?.offers ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Offers" value={stats.total} />
          <StatCard label="Accepted" value={stats.byStatus.ACCEPTED ?? 0} />
          <StatCard label="Joined" value={stats.byStatus.JOINED ?? 0} />
          <StatCard
            label="Average CTC"
            value={stats.ctc.average ? `${stats.ctc.average.toFixed(2)} LPA` : "—"}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setFormError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Record offer
        </Button>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-48"
        >
          <option value="">All statuses</option>
          {OFFER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatusLabel(s)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-48"
        >
          <option value="">All categories</option>
          {OFFER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {formatStatusLabel(c)}
            </option>
          ))}
        </Select>
      </div>

      {offers.length === 0 ? (
        <EmptyState
          icon={<Award className="h-10 w-10" />}
          title="No offers recorded"
          description="Offers appear here once an application is marked Selected and an offer is recorded against it."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Company / Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Offer Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{studentName(o.student)}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.student.enrollmentNumber}
                        {o.student.branch ? ` · ${o.student.branch.code}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{o.company.name}</div>
                      <div className="text-xs text-muted-foreground">{o.jobRole.title}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={o.type} />
                        <StatusBadge status={o.category} />
                        {o.isPPO && <StatusBadge status="PPO" label="PPO" />}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {o.ctc != null ? `${o.ctc} LPA` : null}
                      {o.ctc != null && o.stipend != null ? " · " : null}
                      {o.stipend != null ? `₹${o.stipend.toLocaleString("en-IN")}/mo` : null}
                      {o.ctc == null && o.stipend == null ? "—" : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(o.offerDate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {o.offerLetterKey && (
                          <Button asChild variant="ghost" size="sm">
                            <a
                              href={`/api/files/${encodeURIComponent(o.offerLetterKey)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="sr-only">View offer letter</span>
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setLetterTarget(o);
                            setLetterFile(null);
                          }}
                        >
                          <Upload className="h-4 w-4" />
                          <span className="sr-only">Upload offer letter</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={NEXT_STATUSES[o.status]?.length === 0}
                          onClick={() => {
                            setStatusTarget(o);
                            setNewStatus(NEXT_STATUSES[o.status]?.[0] ?? "");
                            setNote("");
                          }}
                        >
                          Update
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Record a new offer */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record an offer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <FormField
              label="Selected application"
              htmlFor="offer-application"
              required
              hint="Only applications marked Selected without an existing offer are listed."
            >
              <Select
                id="offer-application"
                value={form.applicationId}
                onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
              >
                <option value="">Choose an application…</option>
                {(offerable?.applications ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {[a.student.firstName, a.student.lastName].filter(Boolean).join(" ") ||
                      a.student.enrollmentNumber}
                    {" — "}
                    {a.jobRole.drive.company.name} · {a.jobRole.title}
                  </option>
                ))}
              </Select>
            </FormField>

            {offerable && offerable.applications.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No applications are currently marked Selected without an offer.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Offer type" htmlFor="offer-type" required>
                <Select
                  id="offer-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {OFFER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatStatusLabel(t)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Category" htmlFor="offer-category" required>
                <Select
                  id="offer-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {OFFER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {formatStatusLabel(c)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="CTC (LPA)"
                htmlFor="offer-ctc"
                hint="Required unless this is a stipend-only internship."
              >
                <Input
                  id="offer-ctc"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ctc}
                  onChange={(e) => setForm({ ...form, ctc: e.target.value })}
                />
              </FormField>

              <FormField label="Stipend (₹ / month)" htmlFor="offer-stipend">
                <Input
                  id="offer-stipend"
                  type="number"
                  min="0"
                  value={form.stipend}
                  onChange={(e) => setForm({ ...form, stipend: e.target.value })}
                />
              </FormField>

              <FormField label="Offer date" htmlFor="offer-date" required>
                <Input
                  id="offer-date"
                  type="date"
                  value={form.offerDate}
                  onChange={(e) => setForm({ ...form, offerDate: e.target.value })}
                />
              </FormField>

              <FormField label="Joining date" htmlFor="offer-joining">
                <Input
                  id="offer-joining"
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                />
              </FormField>

              <FormField label="Location" htmlFor="offer-location">
                <Input
                  id="offer-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Bengaluru"
                />
              </FormField>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={form.isPPO}
                    onChange={(e) => setForm({ ...form, isPPO: e.target.checked })}
                  />
                  Pre-placement offer (PPO)
                </label>
              </div>
            </div>

            <FormField label="CTC breakdown" htmlFor="offer-breakdown">
              <Textarea
                id="offer-breakdown"
                value={form.ctcBreakdown}
                onChange={(e) => setForm({ ...form, ctcBreakdown: e.target.value })}
                placeholder="Base: 12L + Bonus: 2L + ESOPs: 4L"
              />
            </FormField>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.applicationId || createMutation.isPending}
              onClick={() => {
                setFormError(null);
                createMutation.mutate();
              }}
            >
              {createMutation.isPending ? "Saving…" : "Record offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change */}
      <Dialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update offer status</DialogTitle>
          </DialogHeader>
          {statusTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {studentName(statusTarget.student)} — {statusTarget.company.name}
              </p>
              <FormField label="New status" htmlFor="offer-status">
                <Select
                  id="offer-status"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  {(NEXT_STATUSES[statusTarget.status] ?? []).map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Note (optional)" htmlFor="offer-note">
                <Textarea
                  id="offer-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason or context for this change"
                />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!newStatus || statusMutation.isPending}
              onClick={() =>
                statusTarget &&
                statusMutation.mutate({ id: statusTarget.id, status: newStatus, note })
              }
            >
              {statusMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer letter upload */}
      <Dialog open={!!letterTarget} onOpenChange={(o) => !o && setLetterTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload offer letter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Offer letter (PDF, max 10MB)" htmlFor="offer-letter">
              <Input
                id="offer-letter"
                type="file"
                accept="application/pdf"
                onChange={(e) => setLetterFile(e.target.files?.[0] ?? null)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLetterTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!letterFile || letterMutation.isPending}
              onClick={() =>
                letterTarget &&
                letterFile &&
                letterMutation.mutate({ id: letterTarget.id, file: letterFile })
              }
            >
              {letterMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}
