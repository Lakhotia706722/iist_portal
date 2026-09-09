"use client";

import * as React from "react";

export type ToastVariant = "default" | "destructive" | "success";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

export interface ToastContextValue {
  toasts: Toast[];
  toast: (props: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
);

/** How long a toast stays on screen before auto-dismissing. */
export const TOAST_DURATION_MS = 5000;
/** Cap so a burst of mutations can't fill the viewport. */
const TOAST_LIMIT = 4;

let toastCounter = 0;

export function useToastState(): ToastContextValue {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback(
    (props: Omit<Toast, "id">) => {
      const id = `toast-${++toastCounter}`;
      setToasts((prev) => [...prev, { ...props, id }].slice(-TOAST_LIMIT));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION_MS)
      );
    },
    [dismiss]
  );

  // Clear any pending timers on unmount so they can't fire into a dead tree.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    };
  }, []);

  return { toasts, toast, dismiss };
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within <Providers /> (ToastProvider)");
  }
  return context;
}
