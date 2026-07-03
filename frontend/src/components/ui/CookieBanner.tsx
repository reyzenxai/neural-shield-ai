"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie_consent")) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between md:left-auto md:right-6 md:max-w-md">
      <p className="text-xs text-muted-foreground">
        We use essential cookies for authentication only - no tracking or ads.{" "}
        <Link href="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>
      </p>
      <button
        onClick={accept}
        className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
      >
        Got it
      </button>
    </div>
  );
}
