"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  FileText,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ScrollText,
  Users,
  X,
} from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { label: "Dashboard",    href: "/admin/dashboard",  icon: LayoutDashboard },
  { label: "Users",        href: "/admin/users",      icon: Users },
  { label: "Scans",        href: "/admin/scans",      icon: Activity },
  { label: "Feedback",     href: "/admin/feedback",   icon: MessageSquare },
  { label: "Payments",     href: "/admin/payments",   icon: IndianRupee },
  { label: "Audit Logs",   href: "/admin/logs",       icon: ScrollText },
];

function NavContents({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

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
        <div className="mt-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
          Admin Console
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1">
        {NAV.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={linkCls(pathname === href || pathname.startsWith(href + "/"))}
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-semibold text-primary ring-1 ring-primary/30">
              {(user?.email ?? "A").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
              <span className="mt-0.5 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                Admin
              </span>
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

        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <FileText className="h-3.5 w-3.5" /> Back to App
        </Link>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
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
