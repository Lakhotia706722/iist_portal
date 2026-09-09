import * as React from "react";
import { cn } from "@/lib/utils";
import { InboxIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** A rendered node (`<Award className="h-7 w-7" />`) or a Lucide icon component. */
  icon?: React.ReactNode | LucideIcon;
  title: string;
  description?: string;
  /** A rendered node, or `{ label, onClick }` to get a default button. */
  action?: React.ReactNode | { label: string; onClick: () => void };
  className?: string;
}

function renderIcon(icon: EmptyStateProps["icon"]): React.ReactNode {
  if (!icon) return <InboxIcon className="h-7 w-7 text-muted-foreground" />;
  // A Lucide icon is a function component — render it at the right size.
  if (typeof icon === "function") {
    const Icon = icon as LucideIcon;
    return <Icon className="h-7 w-7 text-muted-foreground" />;
  }
  return icon as React.ReactNode;
}

function renderAction(action: EmptyStateProps["action"]): React.ReactNode {
  if (!action) return null;
  if (
    typeof action === "object" &&
    action !== null &&
    "label" in action &&
    "onClick" in action
  ) {
    const a = action as { label: string; onClick: () => void };
    return <Button onClick={a.onClick}>{a.label}</Button>;
  }
  return action as React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        {renderIcon(icon)}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md px-4 text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{renderAction(action)}</div>}
    </div>
  );
}
