const KEY = "ns_device_id";

/**
 * A stable per-browser device id used to enforce a single active device per account.
 * Persisted in localStorage; generated on first use. Empty string on the server.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
