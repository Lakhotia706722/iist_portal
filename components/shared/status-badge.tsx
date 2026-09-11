import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/**
 * Single source of truth for status colour + label across the portal.
 * Add new statuses here rather than re-deriving colours per component.
 */
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // Audit actions
  CREATE: "success",
  UPDATE: "info",
  DELETE: "destructive",
  LOGIN: "secondary",
  LOGOUT: "secondary",
  PASSWORD_RESET: "warning",
  ROLE_CHANGE: "warning",
  STATUS_CHANGE: "info",
  EXPORT: "secondary",

  // Application
  APPLIED: "secondary",
  UNDER_REVIEW: "info",
  SHORTLISTED: "info",
  WRITTEN_TEST: "info",
  TECHNICAL_ROUND: "info",
  HR_ROUND: "info",
  FINAL_ROUND: "info",
  SELECTED: "success",
  REJECTED: "destructive",
  WITHDRAWN: "secondary",
  ON_HOLD: "warning",

  // Offer
  OFFERED: "info",
  ACCEPTED: "success",
  DECLINED: "destructive",
  JOINED: "success",

  // Drive
  DRAFT: "secondary",
  PUBLISHED: "info",
  APPLICATIONS_OPEN: "success",
  APPLICATIONS_CLOSED: "warning",
  ONGOING: "info",
  COMPLETED: "success",
  CANCELLED: "destructive",

  // Document / video / profile
  PENDING: "warning",
  PENDING_VERIFICATION: "warning",
  VERIFIED: "success",
  RE_UPLOAD_REQUESTED: "destructive",
  NOT_UPLOADED: "secondary",
  INCOMPLETE: "warning",
  DEBARRED: "destructive",

  // Attendance
  PRESENT: "success",
  ABSENT: "destructive",
  LATE: "warning",
  EXCUSED: "secondary",

  // Round results (both spellings appear in the UI)
  PASS: "success",
  PASSED: "success",
  FAIL: "destructive",
  FAILED: "destructive",
  HOLD: "warning",
  EXEMPTED: "secondary",
};

/** Statuses whose default Title Case rendering isn't what we want. */
const STATUS_LABELS: Record<string, string> = {
  RE_UPLOAD_REQUESTED: "Re-upload",
  APPLICATIONS_OPEN: "Applications Open",
  APPLICATIONS_CLOSED: "Applications Closed",
  PENDING_VERIFICATION: "Pending Verification",
  NOT_UPLOADED: "Not Uploaded",
  ON_HOLD: "On Hold",
  HR_ROUND: "HR Round",
  INTERNSHIP_WITH_PPO: "Internship + PPO",
  NON_CORE: "Non-Core",
  FULL_TIME: "Full-Time",
};

export function formatStatusLabel(status: string): string {
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export interface StatusBadgeProps {
  status: string;
  /** Override the derived label. */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[status] ?? "secondary";
  return (
    <Badge variant={variant} className={cn("whitespace-nowrap", className)}>
      {label ?? formatStatusLabel(status)}
    </Badge>
  );
}
