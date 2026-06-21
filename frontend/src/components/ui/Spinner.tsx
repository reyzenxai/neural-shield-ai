import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = {
  /** pixel size of the spinner icon (default 16) */
  size?: number;
  className?: string;
  /** accessible label for screen readers */
  label?: string;
};

/**
 * Loading spinner matching the Lovable animation (spinning Loader2 in primary tone).
 * @returns an animated, accessible spinner
 */
export function Spinner({ size = 16, className, label = "Loading" }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex">
      <Loader2
        className={cn("animate-spin text-primary", className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
