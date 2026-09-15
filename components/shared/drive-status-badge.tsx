import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDriveStatusLabel, getDriveStatusVariant, type DriveStatusInput } from "@/lib/drive-status";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/**
 * Phase 19 — the one place a drive's status renders as a badge. A raw
 * `<StatusBadge status={drive.status} />` would now always say "Published"
 * (that manual sub-step was removed — see lib/drive-status.ts), losing the
 * open/closed signal every previous caller relied on. This derives it
 * instead, from the same dates the drive already has.
 */
export function DriveStatusBadge({ drive, className }: { drive: DriveStatusInput; className?: string }) {
  return (
    <Badge variant={getDriveStatusVariant(drive) as BadgeVariant} className={cn("whitespace-nowrap", className)}>
      {getDriveStatusLabel(drive)}
    </Badge>
  );
}
