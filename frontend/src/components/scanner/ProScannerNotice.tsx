"use client";

import Link from "next/link";
import { UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * Placeholder panel for the screenshot (OCR) and QR scanners, which are Pro-tier
 * and rolling out. Shows an (inert) upload affordance + an upgrade path. The real
 * extraction lands as a focused follow-up (see DECISIONS.md D6).
 */
export function ProScannerNotice({ kind }: { kind: "screenshot" | "qr" }) {
  const copy =
    kind === "screenshot"
      ? { what: "Screenshot OCR", hint: "Upload a screenshot — we'll extract the text and analyze it." }
      : { what: "QR Code decoding", hint: "Upload a QR image — we'll decode the link and scan it." };

  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Upload</span>
        <Badge variant="accent" size="sm">
          Pro
        </Badge>
      </div>

      <div className="grid place-items-center rounded-2xl border border-dashed border-border/70 bg-background/30 px-6 py-12 text-center opacity-70">
        <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
        <div className="text-sm font-medium text-foreground">{copy.what}</div>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">{copy.hint}</p>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {copy.what} is a Pro feature that&apos;s rolling out soon. In the meantime, copy any visible
        text into the{" "}
        <Link href="/analyzer/message" className="text-primary hover:underline">
          Message scanner
        </Link>
        .
      </p>

      <Button asChild variant="primary" size="md" className="mt-4 w-full">
        <Link href="/dashboard">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}
