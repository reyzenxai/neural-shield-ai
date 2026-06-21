"use client";

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile, SignupData } from "@/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

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

    const profile = session?.user ? await loadProfile(session.user.id) : null;
    set({
      session,
      user: session?.user ?? null,
      profile,
      status: session?.user ? "authenticated" : "unauthenticated",
      isAuthenticated: Boolean(session?.user),
    });

    supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      const nextProfile = nextSession?.user
        ? await loadProfile(nextSession.user.id)
        : null;
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
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
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
