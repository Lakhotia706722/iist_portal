import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  text?: string;
  className?: string;
  fullPage?: boolean;
}

export function LoadingState({
  text = "Loading...",
  className,
  fullPage,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        fullPage ? "min-h-screen" : "py-16",
        className
      )}
    >
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
