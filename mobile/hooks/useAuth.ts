import { useEffect } from "react";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";

export function useAuthListener() {
  const { setSession, clearAuth } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session as any);
        SecureStore.setItemAsync("access_token", session.access_token);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session as any);
        SecureStore.setItemAsync("access_token", session.access_token);
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

export async function signOut() {
  await supabase.auth.signOut();
  router.replace("/(auth)/login");
}
