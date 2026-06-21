"use client";

import { useAppStore } from "@/store/useAppStore";

/**
 * Convenience hook exposing the current auth state and actions from the store.
 */
export function useAuth() {
  const user = useAppStore((s) => s.user);
  const profile = useAppStore((s) => s.profile);
  const status = useAppStore((s) => s.status);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const signIn = useAppStore((s) => s.signIn);
  const signUp = useAppStore((s) => s.signUp);
  const signInWithOAuth = useAppStore((s) => s.signInWithOAuth);
  const signOut = useAppStore((s) => s.signOut);
  const refreshProfile = useAppStore((s) => s.refreshProfile);

  return {
    user,
    profile,
    status,
    isAuthenticated,
    isLoading: status === "loading",
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    refreshProfile,
  };
}
