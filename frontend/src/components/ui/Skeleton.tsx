import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Use to reserve layout for async content.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-white/5", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
