// Content script — runs on every page at document_idle.
// Passively scans anchor hrefs for known high-risk TLDs and suspicious patterns,
// and reports to the background worker so the badge can be updated.
// No API calls here — keeps the content script lightweight and offline-capable.

const HIGH_RISK_TLDS = new Set([".xyz", ".top", ".tk", ".ml", ".ga", ".cf", ".gq", ".pw"]);

const SUSPICIOUS_PATTERNS = [
  /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/, // raw IP
  /verify.*account/i,
  /secure.*login/i,
  /update.*kyc/i,
  /claim.*prize/i,
  /free.*money/i,
];

function isSuspiciousUrl(href: string): boolean {
  try {
    const url = new URL(href);
    const tld = "." + url.hostname.split(".").slice(-1)[0].toLowerCase();
    if (HIGH_RISK_TLDS.has(tld)) return true;
    return SUSPICIOUS_PATTERNS.some((p) => p.test(href));
  } catch {
    return false;
  }
}

function addWarningBadge(anchor: HTMLAnchorElement): void {
  if (anchor.dataset.nsMarked) return;
  anchor.dataset.nsMarked = "1";
  const badge = document.createElement("span");
  badge.textContent = "⚠";
  badge.title = "Neural Shield: suspicious link detected";
  badge.style.cssText =
    "display:inline-block;margin-left:3px;font-size:.75em;color:#f97316;cursor:help;";
  anchor.insertAdjacentElement("afterend", badge);
}

function scanAnchors(): void {
  let found = false;
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("http")) return;
    if (isSuspiciousUrl(href)) {
      addWarningBadge(a);
      found = true;
    }
  });

  if (found) {
    chrome.runtime.sendMessage({ type: "CONTENT_RISK", riskLevel: "medium" }).catch(() => {});
  }
}

// Initial scan on load
scanAnchors();

// Re-scan when DOM changes (SPAs that inject links dynamically)
const observer = new MutationObserver(() => scanAnchors());
observer.observe(document.body, { childList: true, subtree: true });
