import * as React from "react";

type ToastVariant = "default" | "destructive" | "success";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (props: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

let toastCounter = 0;

export function useToast() {
  const context = React.useContext(ToastContext);
  if (context) {
    return context;
  }
  
  // Fallback implementation when not wrapped in provider
  return {
    toasts: [],
    toast: (props: Omit<Toast, 'id'>) => {
      console.log('Toast:', props);
    },
    dismiss: (id: string) => {
      console.log('Dismiss toast:', id);
    }
  };
}