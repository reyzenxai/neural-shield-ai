import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
  email: string;
}

const STORAGE_KEY = "ns_auth";

export async function getStoredAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StoredAuth) ?? null;
}

async function setStoredAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: auth });
}

export async function clearStoredAuth(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function signIn(email: string, password: string): Promise<StoredAuth> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error_description?: string }).error_description ?? "Sign-in failed.");
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { email: string };
  };

  const auth: StoredAuth = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    email: data.user.email,
  };
  await setStoredAuth(auth);
  return auth;
}

export async function refreshAuth(stored: StoredAuth): Promise<StoredAuth> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: stored.refreshToken }),
  });

  if (!res.ok) {
    await clearStoredAuth();
    throw new Error("Session expired. Please sign in again.");
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { email: string };
  };

  const auth: StoredAuth = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    email: stored.email,
  };
  await setStoredAuth(auth);
  return auth;
}

/** Returns a valid access token, refreshing if needed. Returns null if not signed in. */
export async function getValidToken(): Promise<string | null> {
  let auth = await getStoredAuth();
  if (!auth) return null;
  // Refresh 60s before expiry.
  if (Date.now() > auth.expiresAt - 60_000) {
    try {
      auth = await refreshAuth(auth);
    } catch {
      return null;
    }
  }
  return auth.accessToken;
}

export async function getApiUrl(): Promise<string> {
  const result = await chrome.storage.local.get("ns_api_url");
  return ((result["ns_api_url"] as string) || "").trim() || "http://localhost:5000";
}

export async function setApiUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ ns_api_url: url.replace(/\/+$/, "") });
}
