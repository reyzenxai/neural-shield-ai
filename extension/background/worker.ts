// MV3 service worker — handles background tasks for Neural Shield AI.
// Runs in a separate worker context; cannot access the DOM.

import { getStoredAuth, refreshAuth } from "../src/auth";

// Proactively refresh the token 5 minutes before it expires.
async function maybeRefreshToken(): Promise<void> {
  const auth = await getStoredAuth();
  if (!auth) return;
  const fiveMin = 5 * 60 * 1000;
  if (Date.now() > auth.expiresAt - fiveMin) {
    try {
      await refreshAuth(auth);
    } catch {
      // Token refresh failed — user will be prompted to sign in on next popup open.
    }
  }
}

// Run on service worker activation and periodically via alarms.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("tokenRefresh", { periodInMinutes: 10 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tokenRefresh") maybeRefreshToken();
});

// Handle messages from popup / content script.
chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown },
    _sender,
    sendResponse: (r: unknown) => void,
  ) => {
    if (message.type === "PING") {
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "GET_AUTH") {
      getStoredAuth().then((auth) => sendResponse({ auth }));
      return true; // keep channel open for async response
    }
    return false;
  },
);

// Badge update helpers — called from content script detections.
function setBadge(text: string, color: string): void {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onMessage.addListener(
  (message: { type: string; riskLevel?: string }, sender) => {
    if (message.type === "CONTENT_RISK" && sender.tab?.id != null) {
      const level = message.riskLevel ?? "unknown";
      const BADGE: Record<string, [string, string]> = {
        critical: ["!", "#ef4444"],
        high: ["!", "#f97316"],
        medium: ["~", "#eab308"],
      };
      const [text, color] = BADGE[level] ?? ["", "#6b7280"];
      chrome.action.setBadgeText({ text, tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color, tabId: sender.tab.id });
    }
  },
);

export {};
