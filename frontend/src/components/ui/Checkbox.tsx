import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Accessible checkbox styled with the primary accent. Wraps a native input so it
 * works in forms and with labels out of the box.
 */
const Checkbox = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "ns-check h-4 w-4 shrink-0 cursor-pointer align-middle",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
