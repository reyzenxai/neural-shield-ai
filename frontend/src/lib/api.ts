import axios from "axios";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Axios client for the Neural Shield backend API. Attaches the current Supabase
 * access token to every request and transparently refreshes it once on a 401.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && isSupabaseConfigured) {
      original._retry = true;
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.refreshSession();
      if (session?.access_token) {
        original.headers.Authorization = `Bearer ${session.access_token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
