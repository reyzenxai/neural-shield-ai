import { useEffect } from "react";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { getProfile } from "../lib/api";

// Tracks whether the next SIGNED_IN event is from a brand-new signup.
// Set to true immediately before calling signInWithPassword after email confirmation.
let _pendingPhoneSetup = false;

export function setPendingPhoneSetup() {
  _pendingPhoneSetup = true;
}

export function useAuthListener() {
  const { setSession, setProfile, clearAuth } = useAuthStore();

  useEffect(() => {
    // Restore session on cold start
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session as any);
        SecureStore.setItemAsync("access_token", session.access_token);
        getProfile().then(p => setProfile(p)).catch(() => {});
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSession(session as any);
        SecureStore.setItemAsync("access_token", session.access_token);

        if (event === "SIGNED_IN") {
          if (_pendingPhoneSetup) {
            _pendingPhoneSetup = false;
            getProfile().then(p => setProfile(p)).catch(() => {});
            router.replace("/phone-setup");
          } else {
            getProfile().then(p => setProfile(p)).catch(() => {});
            router.replace("/(tabs)/home");
          }
        }
      } else {
        clearAuth();
        SecureStore.deleteItemAsync("access_token");
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw error;
  return data;
}

/** Send a 6-digit OTP to the given email via Supabase */
export async function sendEmailOTP(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/**
 * Verify the OTP, set password + name, update profiles table, then
 * signal the auth listener to route to /phone-setup.
 */
export async function verifyEmailOTPAndSignUp(
  email: string,
  token: string,
  password: string,
  name: string,
): Promise<void> {
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: "email",
  });
  if (verifyErr) throw verifyErr;

  const { error: updateErr } = await supabase.auth.updateUser({
    password,
    data: { full_name: name, name },
  });
  if (updateErr) {
    await supabase.auth.signOut();
    throw new Error(
      "Account created but we couldn't set your password. Please try signing up again.",
    );
  }

  // Ensure profiles.name is set (trigger may have fired before metadata was set)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
  }

  // Signal auth listener to route to phone-setup instead of home
  _pendingPhoneSetup = true;
}

export async function signInWithGoogle() {
  throw new Error("Google sign-in requires a new app build. Use email login for now.");
}

export async function signOut() {
  await supabase.auth.signOut();
  router.replace("/(auth)/login");
}
