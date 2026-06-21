"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** show a live character counter in the bottom-right */
  showCount?: boolean;
}

/**
 * Multi-line textarea with the Neural Shield focus treatment and an optional
 * character counter (uses `maxLength` for the denominator when provided).
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, showCount = false, maxLength, value, defaultValue, onChange, ...props }, ref) => {
    const initial = String(value ?? defaultValue ?? "").length;
    const [count, setCount] = React.useState(initial);

    React.useEffect(() => {
      if (value !== undefined) setCount(String(value).length);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCount(e.target.value.length);
      onChange?.(e);
    };

    return (
      <div className="relative">
        <textarea
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          onChange={handleChange}
          className={cn(
            "flex min-h-[140px] w-full resize-none rounded-2xl border border-border bg-background/40 p-4 text-sm leading-relaxed text-foreground shadow-sm transition-colors",
            "placeholder:text-muted-foreground/70",
            "focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showCount && "pb-8",
            className,
          )}
          {...props}
        />
        {showCount && (
          <span className="pointer-events-none absolute bottom-3 right-4 font-mono text-[11px] text-muted-foreground">
            {count}
            {maxLength ? `/${maxLength}` : ""}
          </span>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
