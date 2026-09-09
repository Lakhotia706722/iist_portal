import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const COMPLIANCE_VARIANTS: Record<string, BadgeVariant> = {
  ELIGIBLE: "success",
  CONDITIONAL: "warning",
  RESTRICTED: "destructive",
  PLACED: "info",
  DEBARRED: "destructive",
};

const COMPLIANCE_LABELS: Record<string, string> = {
  ELIGIBLE: "Eligible",
  CONDITIONAL: "Conditional",
  RESTRICTED: "Restricted",
  PLACED: "Placed",
  DEBARRED: "Debarred",
};

export function ComplianceBadge({
  status,
  isOverridden,
  className,
}: {
  status: string;
  isOverridden?: boolean;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={COMPLIANCE_VARIANTS[status] ?? "secondary"} className={cn("whitespace-nowrap", className)}>
        {COMPLIANCE_LABELS[status] ?? status}
      </Badge>
      {isOverridden && (
        <span title="This status was manually set by an admin, overriding the computed value.">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" aria-label="Manually overridden" />
        </span>
      )}
    </span>
  );
}
