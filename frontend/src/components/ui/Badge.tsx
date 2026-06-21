import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary",
        neutral: "border-border bg-card/50 text-muted-foreground",
        secondary: "border-secondary/30 bg-secondary/15 text-secondary",
        accent: "border-accent/30 bg-accent/15 text-accent",
        // Risk levels (spec): SAFE / SUSPICIOUS / DANGEROUS / CRITICAL (pulsing).
        safe: "border-success/30 bg-success/15 text-success",
        suspicious: "border-warning/30 bg-warning/15 text-warning",
        dangerous: "border-danger/30 bg-danger/15 text-danger",
        critical: "border-danger/40 bg-danger/20 text-danger animate-threat-glow",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** show a leading status dot */
  dot?: boolean;
}

/**
 * Status / risk-level badge. Use the risk variants (safe | suspicious | dangerous |
 * critical) for scan verdicts; critical pulses with a threat glow.
 */
function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </div>
  );
}

/** Map the AI riskLevel enum to a Badge variant. */
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
export function riskBadgeVariant(level: RiskLevel): BadgeProps["variant"] {
  switch (level) {
    case "safe":
    case "low":
      return "safe";
    case "medium":
      return "suspicious";
    case "high":
      return "dangerous";
    case "critical":
      return "critical";
  }
}

export { Badge, badgeVariants };
