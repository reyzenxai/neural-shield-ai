"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "./Input";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide eye toggle. Same props as a native input
 * (minus `type`, which it controls). The toggle is skipped in the tab order so it
 * doesn't interrupt keyboard form flow.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
