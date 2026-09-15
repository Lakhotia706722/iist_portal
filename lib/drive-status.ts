/**
 * Phase 19 — "applications open/closed" used to be a distinct DriveStatus
 * value (APPLICATIONS_OPEN / APPLICATIONS_CLOSED) an admin had to
 * manually click into and out of, disconnected from the
 * applicationOpenAt/applicationCloseAt dates already on the drive. That
 * produced exactly the reported bug: a published drive whose open date
 * had already passed still showed "not yet open," because nothing had
 * (or, for closing, ever would — the matching auto-close job was written
 * but never wired to run anywhere) clicked the status forward.
 *
 * The fix: once a drive is PUBLISHED, whether it's currently accepting
 * applications is a pure function of `now` vs. its dates — computed
 * everywhere it's needed, never stored. DRAFT -> PUBLISHED remains the
 * one real manual step; PUBLISHED -> ONGOING (rounds starting) now
 * requires the derived "closed" state rather than a separate manual
 * APPLICATIONS_CLOSED click. A one-time migration backfills any existing
 * APPLICATIONS_OPEN/APPLICATIONS_CLOSED rows to PUBLISHED; those enum
 * values remain in the schema (harmless, avoids a risky Postgres enum-type
 * rebuild) but are never set again going forward.
 *
 * Every function here is a pure function of data already on hand — no
 * Prisma client dependency at runtime, so this is safe to import from
 * both server code and "use client" components.
 */

export type ApplicationWindow = "not_open_yet" | "open" | "closed";

export interface DriveDates {
  applicationOpenAt: Date | string | null;
  applicationCloseAt: Date | string | null;
}

export interface DriveStatusInput extends DriveDates {
  status: string;
}

function toDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

/** Pure date-window computation — independent of DriveStatus. */
export function getApplicationWindow(drive: DriveDates, now: Date = new Date()): ApplicationWindow {
  const opensAt = toDate(drive.applicationOpenAt);
  const closesAt = toDate(drive.applicationCloseAt);
  if (opensAt && now < opensAt) return "not_open_yet";
  if (closesAt && now >= closesAt) return "closed";
  return "open";
}

/** True only for a PUBLISHED drive whose date window says "open" right now. */
export function isAcceptingApplications(drive: DriveStatusInput, now: Date = new Date()): boolean {
  return drive.status === "PUBLISHED" && getApplicationWindow(drive, now) === "open";
}

/**
 * True once a drive has ever reached its application-open date (or moved
 * past PUBLISHED entirely) — mirrors the old "cannot edit a job role once
 * applications have opened" rule, which used to check
 * status === APPLICATIONS_OPEN/ONGOING/COMPLETED literally.
 */
export function hasApplicationWindowStarted(drive: DriveStatusInput, now: Date = new Date()): boolean {
  if (["ONGOING", "COMPLETED"].includes(drive.status)) return true;
  if (drive.status !== "PUBLISHED") return false;
  return getApplicationWindow(drive, now) !== "not_open_yet";
}

/**
 * True once applications have definitively closed — mirrors the old
 * "rounds/shortlisting require APPLICATIONS_CLOSED or ONGOING" rule.
 * Deliberately excludes COMPLETED, matching that rule's original scope
 * (a completed drive doesn't get new rounds either, but that's a
 * different, status-based check already handled by callers).
 */
export function hasApplicationsClosed(drive: DriveStatusInput, now: Date = new Date()): boolean {
  if (drive.status === "ONGOING") return true;
  if (drive.status !== "PUBLISHED") return false;
  return getApplicationWindow(drive, now) === "closed";
}

/**
 * Prisma `where` fragment for "PUBLISHED and currently accepting
 * applications" — the single source of truth for every list/count query
 * that used to check `status: "APPLICATIONS_OPEN"` (or, worse, had
 * independently drifted copies of this same date logic — see
 * student/dashboard/page.tsx before this phase). Typed loosely (not
 * `Prisma.PlacementDriveWhereInput`) so this file stays free of a runtime
 * `@prisma/client` import and remains safe for client components.
 */
export function acceptingApplicationsWhere(now: Date = new Date()): any {
  return {
    status: "PUBLISHED",
    AND: [
      { OR: [{ applicationOpenAt: null }, { applicationOpenAt: { lte: now } }] },
      { OR: [{ applicationCloseAt: null }, { applicationCloseAt: { gt: now } }] },
    ],
  };
}

/** Display label for a drive's real, current state — derives the PUBLISHED sub-state, passes everything else through. */
export function getDriveStatusLabel(drive: DriveStatusInput, now: Date = new Date()): string {
  if (drive.status === "PUBLISHED") {
    const window = getApplicationWindow(drive, now);
    if (window === "not_open_yet") return "Not Open Yet";
    if (window === "closed") return "Applications Closed";
    return "Applications Open";
  }
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    ONGOING: "Ongoing",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return labels[drive.status] ?? drive.status;
}

/** Badge variant matching getDriveStatusLabel's derived states — see components/ui/badge.tsx for the variant set. */
export function getDriveStatusVariant(
  drive: DriveStatusInput,
  now: Date = new Date()
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" {
  if (drive.status === "PUBLISHED") {
    const window = getApplicationWindow(drive, now);
    if (window === "not_open_yet") return "info";
    if (window === "closed") return "warning";
    return "success";
  }
  const variants: Record<string, "secondary" | "info" | "success" | "destructive"> = {
    DRAFT: "secondary",
    ONGOING: "info",
    COMPLETED: "success",
    CANCELLED: "destructive",
  };
  return variants[drive.status] ?? "secondary";
}

/** One-sentence, purely informational status — for the admin overview banner. Never asks for an action; there's nothing left to manually trigger. */
export function getApplicationWindowMessage(drive: DriveDates, now: Date = new Date()): string {
  const window = getApplicationWindow(drive, now);
  if (window === "not_open_yet") {
    const opensAt = toDate(drive.applicationOpenAt)!;
    const days = Math.ceil((opensAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const when = opensAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    return days <= 1 ? `Applications open on ${when}.` : `Applications open in ${days} days, on ${when}.`;
  }
  if (window === "closed") return "Applications are closed.";
  return "Applications are currently open.";
}
