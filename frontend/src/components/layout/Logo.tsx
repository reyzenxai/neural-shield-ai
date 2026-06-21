import Link from "next/link";
import { Shield } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Neural Shield brand mark. Renders as a link to `href` (default home).
 */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2", className)}
      aria-label="Neural Shield AI — home"
    >
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
        <Shield className="h-4 w-4 text-primary" />
      </div>
      <span className="font-display text-sm font-semibold tracking-tight">Neural Shield</span>
      <span className="ml-0.5 rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
        AI
      </span>
    </Link>
  );
}
