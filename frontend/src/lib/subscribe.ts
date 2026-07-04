import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Add an email to the update list (idempotent, validated server-side). */
export async function subscribe(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Subscriptions are not configured yet.");
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("app_subscribe", { p_email: email });
  if (error) {
    if (error.message.includes("invalid_email")) throw new Error("Please enter a valid email.");
    throw new Error("Could not subscribe. Please try again.");
  }
}
