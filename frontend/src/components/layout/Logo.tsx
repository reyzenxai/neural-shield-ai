import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Neural Shield brand mark. Renders as a link to `href` (default home).
 */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5", className)}
      aria-label="Neural Shield AI — home"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" aria-hidden="true" />
      <span className="font-display text-sm font-semibold tracking-tight">Neural Shield</span>
      <span className="ml-0.5 rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
        AI
      </span>
    </Link>
  );
}
