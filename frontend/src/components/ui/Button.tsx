import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium cursor-pointer transition disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Pill CTA - the Lovable hero button: glowing primary that scales on hover.
        primary:
          "rounded-full bg-primary text-primary-foreground font-semibold glow-primary hover:scale-[1.03]",
        // Pill secondary CTA - glassy outline.
        secondary:
          "rounded-full border border-border bg-card/40 text-foreground/90 backdrop-blur hover:border-primary/40",
        ghost:
          "rounded-full text-foreground/80 hover:bg-card/50 hover:text-foreground",
        destructive:
          "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "rounded-full border border-border bg-transparent hover:border-primary/40 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3.5 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-sm",
        xl: "h-14 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** render as the single child element (Radix Slot) instead of a <button> */
  asChild?: boolean;
  /** show a spinner and disable interaction */
  loading?: boolean;
}

/**
 * Primary button primitive in the Neural Shield design language.
 * Variants: primary (glow pill) | secondary | ghost | destructive | outline | link.
 * @param loading - when true, shows a spinner and disables the button
 * @param asChild - render the child element instead of a button (cannot combine with loading)
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={!asChild ? disabled || loading : undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
