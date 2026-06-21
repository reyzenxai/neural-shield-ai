"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeIndianRupee,
  Image as ImageIcon,
  Link2,
  Mail,
  MessageSquare,
  QrCode,
  Smartphone,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ScanType } from "@/types";

const TABS: { type: ScanType; label: string; href: string; icon: typeof MessageSquare }[] = [
  { type: "message", label: "Message", href: "/analyzer/message", icon: MessageSquare },
  { type: "url", label: "URL", href: "/analyzer/url", icon: Link2 },
  { type: "email", label: "Email", href: "/analyzer/email", icon: Mail },
  { type: "screenshot", label: "Screenshot", href: "/analyzer/screenshot", icon: ImageIcon },
  { type: "qr", label: "QR Code", href: "/analyzer/qr", icon: QrCode },
  { type: "phone", label: "Phone", href: "/analyzer/phone", icon: Smartphone },
  { type: "upi", label: "UPI", href: "/analyzer/upi", icon: BadgeIndianRupee },
];

/**
 * Content for a scanner page (rendered inside the dashboard shell): page heading,
 * scanner-type tabs, and a two-column input/result layout.
 */
export function ScannerShell({
  active,
  title,
  description,
  input,
  result,
}: {
  active: ScanType;
  title: string;
  description: string;
  input: React.ReactNode;
  result: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ type, label, href, icon: Icon }) => {
          const isActive = type === active || pathname === href;
          return (
            <Link
              key={type}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary glow-primary"
                  : "border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>{input}</div>
        <div>{result}</div>
      </div>
    </div>
  );
}
