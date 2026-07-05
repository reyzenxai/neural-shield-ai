"use client";

import { useState } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";

/** Inline brand SVGs so we don't pull in an icon pack for two logos. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.2C41.4 36 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

/**
 * Google OAuth button. On click, Supabase redirects to Google and back to
 * /auth/callback.
 */
export function OAuthButtons() {
  const { signInWithOAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithOAuth("google");
      // success navigates away; no need to reset busy
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not start sign-in.");
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/40 text-sm font-medium transition hover:border-primary/40 disabled:opacity-50"
      >
        {busy ? <Spinner size={16} /> : <GoogleIcon />} Continue with Google
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
