"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Clock, RefreshCw, Users
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── types ────────────────────────────────────────────── */
interface Round {
  id: string;
  roundNumber: number;
  title: string;
  type: string;
  mode: string;
  scheduledAt: string | null;
  durationMins: number | null;
  venue: string | null;
  instructions: string | null;
  participantCount?: number;
}

interface Participant {
  id: string;
  studentId: string;
  student: { enrollmentNumber: string; user: { name: string } };
  status: string;
  result: string | null;
  feedback: string | null;
  attendanceStatus: string | null;
}

interface Props { driveId: string; driveStatus: string }

// Must match RoundType / ApplicationStatus enums in prisma/schema.prisma —
// this list previously used invented values ("APTITUDE", "TECHNICAL", "HR",
// "CASE_STUDY", "ASSIGNMENT") that never matched RoundType, so selecting
// most of them and saving would 400.
const ROUND_TYPES = [
  "WRITTEN_TEST", "APTITUDE_TEST", "CODING_TEST", "TECHNICAL_INTERVIEW",
  "HR_INTERVIEW", "GROUP_DISCUSSION", "PRESENTATION", "MEDICAL",
  "DOCUMENT_VERIFICATION", "OTHER",
];
const ROUND_MODES = ["ONLINE", "OFFLINE", "HYBRID"];
// participantResultSchema's real enum is PASS/FAIL/PENDING/HOLD, not
// PASSED/FAILED/ON_HOLD.
const RESULT_OPTIONS = ["PASS", "FAIL", "PENDING", "HOLD"];
// AttendanceStatus enum is PRESENT/ABSENT/LATE/EXCUSED — "EXEMPTED" was
// never a real value and "LATE" was missing.
const ATTENDANCE_OPTIONS = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

/* ── round form ───────────────────────────────────────── */
function RoundForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<Round>;
  onSave: (data: {
    title: string; type: string; mode: string;
    scheduledAt?: string; durationMins?: number; venue?: string; instructions?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    type: initial?.type ?? "TECHNICAL_INTERVIEW",
    mode: initial?.mode ?? "OFFLINE",
    scheduledAt: initial?.scheduledAt?.slice(0, 16) ?? "",
    durationMins: initial?.durationMins?.toString() ?? "",
    venue: initial?.venue ?? "",
    instructions: initial?.instructions ?? "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <Card className="border-primary/40">
      <CardContent className="p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title *</label>
            <Input value={form.title} onChange={set("title")} placeholder="e.g. Technical Interview" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROUND_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mode</label>
            <Select value={form.mode} onValueChange={v => setForm(p => ({ ...p, mode: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROUND_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Scheduled At</label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={set("scheduledAt")} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Duration (minutes)</label>
            <Input type="number" value={form.durationMins} onChange={set("durationMins")} placeholder="60" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Venue / Link</label>
            <Input value={form.venue} onChange={set("venue")} placeholder="Room 101 / Zoom link" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Instructions</label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.instructions} onChange={set("instructions") as any}
            placeholder="Any notes for participants…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={!form.title}
            onClick={() => onSave({
              title: form.title, type: form.type, mode: form.mode,
              // roundSchema's optional fields accept undefined or "" — not
              // null. Sending null (the previous behavior) always 400'd
              // for any round with an empty optional field, i.e. every
              // round that didn't fill in every single field.
              scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
              durationMins: form.durationMins ? parseInt(form.durationMins) : undefined,
              venue: form.venue || undefined, instructions: form.instructions || undefined,
            })}>
            Save Round
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── attendance row ───────────────────────────────────── */
function AttendanceRow({ p, onUpdate }: {
  p: Participant;
  onUpdate: (id: string, attendance: string, result?: string, feedback?: string) => void;
}) {
  const [attendance, setAttendance] = useState(p.attendanceStatus ?? "");
  const [result, setResult] = useState(p.result ?? "");
  const [feedback, setFeedback] = useState(p.feedback ?? "");

  return (
    <tr className="border-b hover:bg-muted/20">
      <td className="p-3">
        <p className="font-medium text-sm">{p.student.user.name}</p>
        <p className="text-xs text-muted-foreground">{p.student.enrollmentNumber}</p>
      </td>
      <td className="p-3">
        <Select value={attendance} onValueChange={v => { setAttendance(v); onUpdate(p.id, v, result, feedback); }}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Mark…" />
          </SelectTrigger>
          <SelectContent>
            {ATTENDANCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="p-3">
        <Select value={result} onValueChange={v => { setResult(v); onUpdate(p.id, attendance, v, feedback); }}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Result…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">—</SelectItem>
            {RESULT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="p-3">
        <Input className="h-8 text-xs" placeholder="Feedback…" value={feedback}
          onChange={e => setFeedback(e.target.value)}
          onBlur={() => onUpdate(p.id, attendance, result, feedback)} />
      </td>
    </tr>
  );
}

/* ── main component ───────────────────────────────────── */
export function DriveRounds({ driveId, driveStatus }: Props) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const canEdit = ["APPLICATIONS_CLOSED", "ONGOING", "SHORTLISTING"].includes(driveStatus);

  const fetchRounds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/drives/${driveId}/rounds`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRounds(data.rounds ?? []);
    } catch {
      toast({ title: "Error", description: "Failed to load rounds.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [driveId, toast]);

  const fetchParticipants = async (roundId: string) => {
    setLoadingParticipants(p => new Set([...p, roundId]));
    try {
      const res = await fetch(`/api/admin/rounds/${roundId}/participants`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setParticipants(prev => ({ ...prev, [roundId]: data.participants ?? [] }));
    } catch {
      toast({ title: "Error", description: "Failed to load participants.", variant: "destructive" });
    } finally {
      setLoadingParticipants(p => { const s = new Set(p); s.delete(roundId); return s; });
    }
  };

  useEffect(() => { fetchRounds(); }, [fetchRounds]);

  const toggleExpand = (roundId: string) => {
    if (expandedRound === roundId) {
      setExpandedRound(null);
    } else {
      setExpandedRound(roundId);
      if (!participants[roundId]) fetchParticipants(roundId);
    }
  };

  const saveRound = async (data: {
    title: string; type: string; mode: string;
    scheduledAt?: string; durationMins?: number; venue?: string; instructions?: string;
  }) => {
    try {
      const url = editingRound
        ? `/api/admin/rounds/${editingRound.id}`
        : `/api/admin/drives/${driveId}/rounds`;
      // roundSchema requires roundNumber (unique per drive) — preserve it
      // on edit, assign the next available one on create. This was never
      // sent before, so every round creation 400'd.
      const payload = {
        ...data,
        roundNumber: editingRound?.roundNumber ?? rounds.length + 1,
      };
      const res = await fetch(url, {
        method: editingRound ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast({ title: editingRound ? "Round updated" : "Round created" });
      setShowForm(false);
      setEditingRound(null);
      fetchRounds();
    } catch {
      toast({ title: "Error", description: "Failed to save round.", variant: "destructive" });
    }
  };

  const deleteRound = async (roundId: string) => {
    if (!confirm("Delete this round?")) return;
    try {
      const res = await fetch(`/api/admin/rounds/${roundId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Round deleted" });
      fetchRounds();
    } catch {
      toast({ title: "Error", description: "Failed to delete round.", variant: "destructive" });
    }
  };

  const updateParticipant = async (
    roundId: string, participantId: string,
    attendance: string, result?: string, feedback?: string,
  ) => {
    try {
      await fetch(`/api/admin/rounds/${roundId}/participants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, attendanceStatus: attendance || undefined, result: result || undefined, feedback: feedback || undefined }),
      });
    } catch {
      /* silent — optimistic UI already updated */
    }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Selection Rounds</h2>
          <p className="text-sm text-muted-foreground">{rounds.length} round{rounds.length !== 1 ? "s" : ""} defined</p>
        </div>
        {canEdit && !showForm && (
          <Button size="sm" onClick={() => { setEditingRound(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />Add Round
          </Button>
        )}
      </div>

      {/* New round form */}
      {showForm && !editingRound && (
        <RoundForm onSave={saveRound} onCancel={() => setShowForm(false)} />
      )}

      {rounds.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No rounds yet"
          description={canEdit ? "Create the first selection round for this drive." : "Rounds can be added once applications close."}
          action={canEdit ? { label: "Add First Round", onClick: () => setShowForm(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {rounds.map(round => {
            const isOpen = expandedRound === round.id;
            const ps = participants[round.id];
            const loadingPs = loadingParticipants.has(round.id);

            return (
              <Card key={round.id}>
                {/* Edit form inline */}
                {editingRound?.id === round.id ? (
                  <CardContent className="p-4">
                    <RoundForm
                      initial={round}
                      onSave={saveRound}
                      onCancel={() => setEditingRound(null)}
                    />
                  </CardContent>
                ) : (
                  <>
                    <CardHeader
                      className="cursor-pointer pb-3 hover:bg-muted/20 transition-colors"
                      onClick={() => toggleExpand(round.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">{round.title}</CardTitle>
                            <Badge variant="secondary" className="text-xs">{round.type.replace(/_/g, " ")}</Badge>
                            <Badge variant="outline" className="text-xs">{round.mode}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-4 mt-1 text-xs text-muted-foreground">
                            {round.scheduledAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(round.scheduledAt).toLocaleString("en-IN", {
                                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                            )}
                            {round.durationMins && <span>{round.durationMins} min</span>}
                            {round.venue && <span>{round.venue}</span>}
                            {round.participantCount !== undefined && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />{round.participantCount} participants
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={e => { e.stopPropagation(); setEditingRound(round); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={e => { e.stopPropagation(); deleteRound(round.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Attendance panel */}
                    {isOpen && (
                      <CardContent className="border-t pt-4">
                        {round.instructions && (
                          <p className="text-sm text-muted-foreground mb-4 bg-muted/50 rounded-md px-3 py-2">
                            {round.instructions}
                          </p>
                        )}
                        <h4 className="font-medium text-sm mb-3">Attendance & Results</h4>
                        {loadingPs ? (
                          <div className="flex justify-center py-6"><LoadingSpinner /></div>
                        ) : !ps || ps.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">No participants added yet.</p>
                        ) : (
                          <div className="overflow-auto rounded-md border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/40">
                                  <th className="p-3 text-left font-medium">Student</th>
                                  <th className="p-3 text-left font-medium">Attendance</th>
                                  <th className="p-3 text-left font-medium">Result</th>
                                  <th className="p-3 text-left font-medium">Feedback</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ps.map(p => (
                                  <AttendanceRow key={p.id} p={p}
                                    onUpdate={(pid, att, res, fb) =>
                                      updateParticipant(round.id, pid, att, res, fb)} />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
