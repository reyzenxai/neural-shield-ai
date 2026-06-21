"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeIndianRupee,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  QrCode,
  Radar,
  Smartphone,
  User,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const ANALYZERS = [
  { label: "Message", href: "/analyzer/message", icon: MessageSquare },
  { label: "URL", href: "/analyzer/url", icon: Link2 },
  { label: "Email", href: "/analyzer/email", icon: Mail },
  { label: "Screenshot", href: "/analyzer/screenshot", icon: ImageIcon },
  { label: "QR Code", href: "/analyzer/qr", icon: QrCode },
  { label: "Phone", href: "/analyzer/phone", icon: Smartphone },
  { label: "UPI", href: "/analyzer/upi", icon: BadgeIndianRupee },
];

function NavContents({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const [analyzerOpen, setAnalyzerOpen] = useState(pathname.startsWith("/analyzer"));
  const plan = profile?.plan ?? "free";

  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
    );

  const onSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-2 py-1">
        <Logo />
      </div>

      <nav className="mt-6 flex-1 space-y-1">
        <Link href="/dashboard" onClick={onNavigate} className={linkCls(pathname === "/dashboard")}>
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Link>

        <div>
          <button
            type="button"
            onClick={() => setAnalyzerOpen((o) => !o)}
            className={cn(linkCls(pathname.startsWith("/analyzer")), "w-full justify-between")}
          >
            <span className="flex items-center gap-3">
              <Radar className="h-4 w-4" /> Analyzer
            </span>
            <ChevronDown className={cn("h-4 w-4 transition", analyzerOpen && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {analyzerOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="ml-3 mt-1 space-y-0.5 border-l border-border pl-3">
                  {ANALYZERS.map(({ label, href, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={onNavigate}
                      className={cn(linkCls(pathname === href), "py-1.5 text-[13px]")}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Link href="/history" onClick={onNavigate} className={linkCls(pathname === "/history")}>
          <Clock className="h-4 w-4" /> History
        </Link>
        <Link href="/profile" onClick={onNavigate} className={linkCls(pathname === "/profile")}>
          <User className="h-4 w-4" /> Profile
        </Link>
      </nav>

      {/* Plan + account */}
      <div className="space-y-3 border-t border-border pt-4">
        {plan === "free" && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <div className="text-sm font-semibold">Upgrade to Pro</div>
            <p className="mt-0.5 text-xs text-muted-foreground">Unlimited scans + all 7 scanners.</p>
            <Button asChild variant="primary" size="sm" className="mt-2 w-full">
              <Link href="/profile" onClick={onNavigate}>
                Go Pro
              </Link>
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-mono text-xs font-semibold text-primary ring-1 ring-primary/30">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile?.name || user?.email || "U").slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
              <Badge variant="default" size="sm" className="mt-1 uppercase">
                {plan}
              </Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-danger/40 hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Authenticated app shell: persistent sidebar on desktop, slide-in drawer on
 * mobile, over the brand grid backdrop.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen">
      <div className="grid-bg pointer-events-none fixed inset-0 -z-10" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-background/60 p-4 backdrop-blur lg:flex">
        <NavContents />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/70 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 max-w-[82vw] glass-strong p-4"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
            >
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavContents onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-5 py-8">{children}</div>
      </div>
    </div>
  );
}
