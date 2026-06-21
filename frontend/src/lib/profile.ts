import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ApiKey, NotificationPrefs } from "@/types";

async function currentUserId(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

/** Update the user's display name. */
export async function updateName(name: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const id = await currentUserId();
  const { error } = await supabase.from("profiles").update({ name }).eq("id", id);
  if (error) throw error;
}

/** Update notification preferences. */
export async function updateNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const id = await currentUserId();
  const { error } = await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", id);
  if (error) throw error;
}

/** Upload an avatar image to Storage and persist its public URL. */
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const id = await currentUserId();
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${id}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`; // cache-bust on re-upload
  const { error: profErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", id);
  if (profErr) throw profErr;
  return url;
}

/** Change the signed-in user's password. */
export async function changePassword(newPassword: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Sign out of all devices/sessions. */
export async function signOutEverywhere(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw error;
}

/** Permanently delete the account via the service-role edge function. */
export async function deleteAccount(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// API keys (Business tier)
// ---------------------------------------------------------------------------

const KEY_PREFIX = "nsk_live";

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

/** List the user's API keys (newest first). */
export async function fetchApiKeys(): Promise<ApiKey[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_four, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ApiKey[]) ?? [];
}

/**
 * Generate a new API key. The full secret is returned ONCE — only its hash is
 * stored. Format: `nsk_live_<48 hex>`.
 */
export async function createApiKey(name: string): Promise<{ key: ApiKey; secret: string }> {
  const supabase = getSupabaseBrowserClient();
  const id = await currentUserId();

  const random = toHex(crypto.getRandomValues(new Uint8Array(24)).buffer);
  const secret = `${KEY_PREFIX}_${random}`;
  const keyHash = await sha256Hex(secret);
  const lastFour = secret.slice(-4);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: id,
      name,
      key_prefix: KEY_PREFIX,
      last_four: lastFour,
      key_hash: keyHash,
    })
    .select("id, name, key_prefix, last_four, created_at, last_used_at, revoked_at")
    .single();
  if (error) throw error;
  return { key: data as ApiKey, secret };
}

/** Revoke an API key (soft-delete). */
export async function revokeApiKey(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
