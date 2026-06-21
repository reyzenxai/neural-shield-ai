"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_NOT_CONFIGURED_MESSAGE,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./config";

let browserClient: SupabaseClient | null = null;

/**
 * Get the singleton browser Supabase client (cookie-based session via @supabase/ssr).
 * @throws if Supabase env vars are not configured.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
