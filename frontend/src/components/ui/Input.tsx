import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Text input with the Neural Shield focus treatment (primary ring + border).
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border bg-background/40 px-4 py-2 text-sm text-foreground shadow-sm transition-colors",
          "placeholder:text-muted-foreground/70",
          "focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
