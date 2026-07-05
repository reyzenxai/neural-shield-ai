"use client";

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getDeviceId } from "@/lib/device";
import type { Profile, SignupData } from "@/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/** Claim the account for this browser (single-active-device enforcement). */
async function claimDevice(): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("app_claim_active_device", { p_device_id: getDeviceId() });
  } catch {
    /* best-effort — never block sign-in on this */
  }
}

/** True if another device has claimed this account (this device was signed out elsewhere). */
function deviceIsStale(profile: Profile | null): boolean {
  const active = (profile as { active_device_id?: string | null } | null)?.active_device_id;
  return Boolean(active && active !== getDeviceId());
}

interface AppState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  status: AuthStatus;
  /** convenience flag derived from status */
  isAuthenticated: boolean;

  /** Bootstrap the session once on app load and subscribe to auth changes. */
  initialize: () => Promise<void>;
  /** Re-fetch the user's profile row. */
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignupData) => Promise<{ needsEmailConfirmation: boolean }>;
  signInWithOAuth: (provider: "google" | "github") => Promise<void>;
  signOut: () => Promise<void>;
}

let initialized = false;

async function loadProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }
  return (data as Profile | null) ?? null;
}

/**
 * Handle a soft-deleted account on login. Within the 30-day window the account is
 * restored (data intact) and the fresh profile is returned. Past the window the
 * account is purged via the delete-account edge function and "expired" is returned so
 * the caller signs out. An active account is returned unchanged.
 */
async function handleSoftDelete(profile: Profile | null): Promise<Profile | null | "expired"> {
  const del = (profile as { deleted_at?: string | null } | null)?.deleted_at;
  const id = (profile as { id?: string } | null)?.id;
  if (!profile || !del || !id) return profile;
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.rpc("app_restore_account");
  const status = (data as { status?: string } | null)?.status;
  if (status === "restored") return await loadProfile(id);
  if (status === "expired") {
    try {
      await supabase.functions.invoke("delete-account", { method: "POST" });
    } catch {
      /* best-effort purge — the account is expired regardless */
    }
    return "expired";
  }
  return profile;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  status: "loading",
  isAuthenticated: false,

  initialize: async () => {
    if (initialized) return;
    initialized = true;

    if (!isSupabaseConfigured) {
      set({ status: "unauthenticated", isAuthenticated: false });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const signedOut = () =>
      set({ user: null, session: null, profile: null, status: "unauthenticated", isAuthenticated: false });

    let profile = session?.user ? await loadProfile(session.user.id) : null;

    // Restore a soft-deleted account (within 30 days) or purge it (after 30 days).
    if (session?.user && profile) {
      const res = await handleSoftDelete(profile);
      if (res === "expired") {
        await supabase.auth.signOut();
        signedOut();
        return;
      }
      profile = res;
    }

    // Single-device enforcement on load: if another device has claimed the account,
    // sign out here; if no device has claimed it yet, claim it for this browser.
    if (session?.user && profile) {
      if (deviceIsStale(profile)) {
        await supabase.auth.signOut();
        signedOut();
        return;
      }
      if (!(profile as { active_device_id?: string | null }).active_device_id) await claimDevice();
    }

    set({
      session,
      user: session?.user ?? null,
      profile,
      status: session?.user ? "authenticated" : "unauthenticated",
      isAuthenticated: Boolean(session?.user),
    });

    // When the tab regains focus, re-check: an old device signs itself out shortly
    // after the account is used to sign in elsewhere.
    if (typeof window !== "undefined") {
      window.addEventListener("focus", async () => {
        const current = get().user;
        if (!current) return;
        const fresh = await loadProfile(current.id);
        if (deviceIsStale(fresh)) {
          await supabase.auth.signOut();
          signedOut();
        } else if (fresh) {
          set({ profile: fresh });
        }
      });
    }

    supabase.auth.onAuthStateChange(async (event, nextSession) => {
      let nextProfile = nextSession?.user ? await loadProfile(nextSession.user.id) : null;

      if (nextSession?.user && nextProfile) {
        // Restore a soft-deleted account on sign-in, or purge it if the window passed.
        const res = await handleSoftDelete(nextProfile);
        if (res === "expired") {
          await supabase.auth.signOut();
          signedOut();
          return;
        }
        nextProfile = res;

        if (event === "SIGNED_IN") {
          await claimDevice(); // this device just authenticated → take over the account
        } else if (deviceIsStale(nextProfile)) {
          await supabase.auth.signOut();
          signedOut();
          return;
        }
      }

      set({
        session: nextSession,
        user: nextSession?.user ?? null,
        profile: nextProfile,
        status: nextSession?.user ? "authenticated" : "unauthenticated",
        isAuthenticated: Boolean(nextSession?.user),
      });
    });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const profile = await loadProfile(user.id);
    set({ profile });
  },

  signIn: async (email, password) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUp: async ({ name, email, password }) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        // After confirming their email, send the user to the login page (not straight in).
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/login` : undefined,
      },
    });
    if (error) throw error;
    // When email confirmation is on, there is no active session yet.
    return { needsEmailConfirmation: !data.session };
  },

  signInWithOAuth: async (provider) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      profile: null,
      status: "unauthenticated",
      isAuthenticated: false,
    });
  },
}));
