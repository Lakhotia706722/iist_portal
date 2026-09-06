/**
 * Empty State Component
 */

"use client";

import { LucideIcon, Briefcase, FileText, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const iconMap = {
  briefcase: Briefcase,
  file: FileText,
  users: Users,
  search: Search,
} as const;

interface EmptyStateProps {
  icon?: LucideIcon | keyof typeof iconMap;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  } | React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  // Determine the icon component
  let IconComponent: LucideIcon | undefined;
  if (typeof icon === "string" && icon in iconMap) {
    IconComponent = iconMap[icon];
  } else if (typeof icon === "function") {
    IconComponent = icon;
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      {IconComponent && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <IconComponent className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      
      <h3 className="text-lg font-semibold text-center mb-2">{title}</h3>
      
      {description && (
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
          {description}
        </p>
      )}
      
      {action && (
        <div className="flex justify-center">
          {typeof action === "object" && "label" in action ? (
            <Button onClick={action.onClick} className="gap-2">
              {action.label}
            </Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}