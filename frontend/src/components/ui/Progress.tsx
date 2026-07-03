"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

type Tone = "primary" | "secondary" | "success" | "warning" | "danger";

const toneBar: Record<Tone, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export interface ProgressProps {
  /** 0-100 */
  value: number;
  tone?: Tone;
  className?: string;
  /** bar thickness utility (default h-1.5) */
  trackClassName?: string;
  /** animate the fill from 0 to value (default true) */
  animate?: boolean;
  /** accessible label */
  label?: string;
}

/**
 * Trust-score / risk-meter bar. Fills from 0 → value with an eased animation,
 * matching the Lovable Score component.
 */
export function Progress({
  value,
  tone = "primary",
  className,
  trackClassName,
  animate = true,
  label,
}: ProgressProps) {
  const pct = clamp(Math.round(value), 0, 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/5", trackClassName, className)}
    >
      <motion.div
        className={cn("h-full rounded-full", toneBar[tone])}
        initial={animate ? { width: 0 } : false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}
