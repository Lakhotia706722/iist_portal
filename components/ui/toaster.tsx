"use client";

import * as React from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ToastContext,
  useToastState,
  useToast,
  type ToastVariant,
} from "@/hooks/use-toast";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-border bg-background text-foreground",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  destructive:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
};

const VARIANT_ICONS: Record<ToastVariant, React.ElementType> = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const value = useToastState();
  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:bottom-4 sm:right-4 sm:max-w-sm sm:p-0"
    >
      {toasts.map((t) => {
        const variant = t.variant ?? "default";
        const Icon = VARIANT_ICONS[variant];
        return (
          <div
            key={t.id}
            role="status"
            aria-live={variant === "destructive" ? "assertive" : "polite"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg",
              "animate-toast-in",
              VARIANT_STYLES[variant]
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="flex-1 space-y-1">
              {t.title && (
                <p className="text-sm font-semibold leading-none">{t.title}</p>
              )}
              {t.description && (
                <p className="text-sm opacity-90">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
