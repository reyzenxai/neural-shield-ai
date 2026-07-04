import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Record whether the user was satisfied with a scan verdict. Writes to the
 * `feedback` table under RLS (owner-only). `satisfied` maps to `is_accurate`:
 * an "unsatisfied" row (is_accurate = false) is what the admin console surfaces
 * for review. Best-effort: a signed-out user or a scan without an id is a no-op.
 */
export async function submitScanFeedback(scanId: string, satisfied: boolean): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in to send feedback.");

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    scan_id: scanId,
    is_accurate: satisfied,
  });
  if (error) throw error;
}
