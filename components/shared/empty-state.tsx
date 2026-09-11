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
  // Already a rendered element (e.g. `<Award className="h-7 w-7" />`) —
  // render as-is.
  if (React.isValidElement(icon)) return icon;
  // Otherwise it's an unrendered component type and needs to be invoked.
  // `typeof icon === "function"` alone used to be the check here, but
  // lucide-react's icons are `React.forwardRef(...)`-wrapped, which is an
  // *object* (`{$$typeof, render}`), not a function — so that check always
  // failed for them and fell through to rendering the raw component
  // reference as a child, crashing with "Objects are not valid as a React
  // child" the moment any EmptyState with a bare icon prop (the majority
  // of the 135 call sites in this app) actually rendered with no data.
  // Found via Phase 9's real-browser verification, not tsc/build/API tests.
  const Icon = icon as LucideIcon;
  return <Icon className="h-7 w-7 text-muted-foreground" />;
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
