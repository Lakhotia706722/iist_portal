"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, STAFF_ROLES, type CreateUserInput } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NativeSelect as Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserCog, Copy, Check } from "lucide-react";

type StaffUser = {
  id: string; name: string; email: string; role: string; isActive: boolean;
  mustChangePassword: boolean; lastLoginAt: string | null;
  facultyProfile: { employeeId: string; designation: string; department: { name: string } } | null;
  hodProfile: { employeeId: string; department: { name: string } } | null;
  companyRepProfile: { companyName: string } | null;
};

const ROLE_LABELS: Record<string, string> = {
  TP_ADMIN: "T&P Admin", FACULTY: "Faculty", HOD: "HOD", COMPANY_REP: "Company Rep", STUDENT: "Student",
};

/**
 * Phase 12 — Admin's "Users & Roles" nav item. /api/admin/users had zero
 * routes before this phase. Same dialog+table CRUD shape as
 * branches-client.tsx, with a role-conditional create form and a one-time
 * temp-password reveal (the password is never shown again after this
 * dialog closes — see user.service.ts's createStaffUser).
 */
export function UsersRolesClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<StaffUser | null>(null);
  const [tempCred, setTempCred] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "200" });
      if (search) p.set("search", search);
      if (roleFilter) p.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${p}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ users: StaffUser[] }>;
    },
  });

  const { data: departments } = useQuery<{ items: { id: string; name: string }[] }>({
    queryKey: ["departments-list-users"],
    queryFn: async () => { const res = await fetch("/api/admin/departments?pageSize=100&includeInactive=false"); return res.json(); },
  });
  const { data: companies } = useQuery<{ companies: { id: string; name: string }[] }>({
    queryKey: ["companies-list-users"],
    queryFn: async () => { const res = await fetch("/api/admin/companies?limit=200"); return res.json(); },
  });

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema) as any,
    defaultValues: { name: "", email: "", role: "FACULTY", employeeId: "", designation: "", departmentId: "", companyId: "" },
  });
  const role = form.watch("role");

  const createMutation = useMutation({
    mutationFn: async (values: CreateUserInput) => {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.formErrors?.[0] || err?.message || "Failed to create user");
      }
      return res.json() as Promise<{ user: { email: string }; tempPassword: string }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setFormOpen(false);
      form.reset();
      setTempCred({ email: data.user.email, password: data.tempPassword });
    },
    onError: (e: Error) => toast({ title: "Couldn't create user", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setStatusTarget(null); },
    onError: (e: Error) => toast({ title: "Couldn't update user", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    form.reset({ name: "", email: "", role: "FACULTY", employeeId: "", designation: "", departmentId: "", companyId: "" });
    setFormOpen(true);
  }

  function subtitle(u: StaffUser) {
    if (u.facultyProfile) return `${u.facultyProfile.department.name} · ${u.facultyProfile.designation}`;
    if (u.hodProfile) return u.hodProfile.department.name;
    if (u.companyRepProfile) return u.companyRepProfile.companyName;
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search name or email..." className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-44" aria-label="Filter by role">
          <option value="">All roles</option>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add User</Button>
      </div>

      <Card>
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : !data?.users.length ? (
          <EmptyState icon={UserCog} title="No users found" action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add User</Button>} className="border-none" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Details</TableHead><TableHead>Status</TableHead><TableHead className="w-28">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell><Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{subtitle(u) ?? "—"}</TableCell>
                  <TableCell><Badge variant={u.isActive ? "success" : "secondary"}>{u.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setStatusTarget(u)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setFormOpen(false)} />
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Name" required error={form.formState.errors.name?.message} htmlFor="u-name">
              <Input id="u-name" {...form.register("name")} />
            </FormField>
            <FormField label="Email" required error={form.formState.errors.email?.message} htmlFor="u-email">
              <Input id="u-email" type="email" {...form.register("email")} />
            </FormField>
            <FormField label="Role" required error={form.formState.errors.role?.message} htmlFor="u-role">
              <Select id="u-role" {...form.register("role")}>
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            </FormField>
            {(role === "FACULTY" || role === "HOD") && (
              <>
                <FormField label="Employee ID" required error={form.formState.errors.employeeId?.message} htmlFor="u-empid">
                  <Input id="u-empid" {...form.register("employeeId")} />
                </FormField>
                <FormField label="Department" required error={form.formState.errors.departmentId?.message} htmlFor="u-dept">
                  <Select id="u-dept" {...form.register("departmentId")}>
                    <option value="">Select department...</option>
                    {departments?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </FormField>
              </>
            )}
            {role === "FACULTY" && (
              <FormField label="Designation" required error={form.formState.errors.designation?.message} htmlFor="u-desig">
                <Input id="u-desig" placeholder="e.g. Assistant Professor" {...form.register("designation")} />
              </FormField>
            )}
            {role === "COMPANY_REP" && (
              <>
                <FormField label="Company Name" required error={form.formState.errors.designation?.message} htmlFor="u-company-name">
                  <Input id="u-company-name" placeholder="Shown on the rep's profile" {...form.register("designation")} />
                </FormField>
                <FormField label="Linked Company (optional)" htmlFor="u-company">
                  <Select id="u-company" {...form.register("companyId")}>
                    <option value="">Not linked yet</option>
                    {companies?.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </FormField>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" loading={createMutation.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tempCred} onOpenChange={(o) => !o && setTempCred(null)}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setTempCred(null)} />
          <DialogHeader><DialogTitle>Account Created</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2 text-sm">
            <p className="text-muted-foreground">Share this temporary password with <strong>{tempCred?.email}</strong> — it won&apos;t be shown again. They&apos;ll be required to set their own password on first login.</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
              <span className="flex-1 break-all">{tempCred?.password}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={async () => {
                  if (tempCred) {
                    try {
                      await navigator.clipboard.writeText(tempCred.password);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch { /* clipboard unavailable — visible text above still works */ }
                  }
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempCred(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={statusTarget?.isActive ? "Deactivate User" : "Activate User"}
        description={statusTarget?.isActive ? `Deactivate "${statusTarget?.name}"? They won't be able to sign in until reactivated.` : `Reactivate "${statusTarget?.name}"?`}
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Activate"}
        onConfirm={() => statusTarget && statusMutation.mutate({ id: statusTarget.id, isActive: !statusTarget.isActive })}
        loading={statusMutation.isPending}
      />
    </div>
  );
}
