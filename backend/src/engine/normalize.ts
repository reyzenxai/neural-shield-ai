/**
 * Module B — type detection + canonicalization (docs/evidence-collection-layer.md §2).
 *
 * No external dependencies: URL parsing uses the WHATWG `URL` (which already converts
 * IDN hosts to punycode), phone normalization is India-first E.164, and the
 * registrable-domain (eTLD+1) extraction uses a curated public-suffix set. Swapping in
 * `tldts` / `libphonenumber-js` later is a drop-in upgrade behind these functions.
 */

import type { Entity, EntityType } from "./types";
import type { ScanType } from "../types";

/** Multi-label public suffixes we care about (India-first + common). */
const MULTI_SUFFIXES = new Set([
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in", "gov.in", "nic.in", "ac.in", "edu.in", "res.in", "mil.in",
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk",
  "com.au", "net.au", "org.au", "gov.au", "edu.au",
  "co.jp", "or.jp", "ne.jp", "go.jp",
  "com.br", "com.sg", "com.my", "co.za", "com.cn", "com.hk", "com.np", "com.bd", "com.pk", "com.lk",
]);

/** URL query params that are pure tracking noise — stripped during canonicalization. */
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "mc_eid", "igshid", "ref", "ref_src", "spm",
]);

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPI_RE = /^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/i;
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{5,20}$/;
// A URL has a scheme, a www. prefix, or a path on a dotted host.
const URLISH_RE = /^(https?:\/\/|www\.)|^[a-z0-9-]+(\.[a-z0-9-]+)+\/.+/i;
// A bare domain: dotted host, no scheme, no path.
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** Extract the registrable domain (eTLD+1) from a host. */
export function registrableDomain(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (IPV4_RE.test(h)) return h;
  const labels = h.split(".");
  if (labels.length <= 2) return h;
  const lastTwo = labels.slice(-2).join(".");
  const lastThree = labels.slice(-3).join(".");
  return MULTI_SUFFIXES.has(lastTwo) ? lastThree : lastTwo;
}

/** Best-effort URL parse; prepends a scheme when missing so bare hosts still parse. */
export function parseUrlSafe(raw: string): URL | null {
  const trimmed = raw.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/** Canonicalize a URL: lowercase host (punycode), strip tracking params + fragment. */
export function normalizeUrl(raw: string): Entity {
  const parsed = parseUrlSafe(raw);
  if (!parsed) {
    return { type: "url", value: raw.trim(), raw, parts: {} };
  }
  const host = parsed.hostname.toLowerCase();
  for (const p of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(p.toLowerCase())) parsed.searchParams.delete(p);
  }
  parsed.hash = "";
  parsed.hostname = host;
  // Drop a trailing "/" with no path for a stable cache key.
  let value = parsed.toString();
  if (parsed.pathname === "/" && !parsed.search) value = value.replace(/\/$/, "");
  const domain = registrableDomain(host);
  return {
    type: "url",
    value,
    raw,
    parts: {
      host,
      domain,
      tld: domain.includes(".") ? domain.split(".").pop() : undefined,
      scheme: parsed.protocol.replace(":", ""),
    },
  };
}

/** Canonicalize a bare domain. */
export function normalizeDomain(raw: string): Entity {
  const host = raw.trim().toLowerCase().replace(/\.$/, "");
  const domain = registrableDomain(host);
  return {
    type: IPV4_RE.test(host) ? "ip" : "domain",
    value: domain,
    raw,
    parts: { host, domain, tld: domain.includes(".") ? domain.split(".").pop() : undefined },
  };
}

/** Canonicalize an email address (lowercased), deriving its sender domain. */
export function normalizeEmail(raw: string): Entity {
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  const local = at >= 0 ? trimmed.slice(0, at) : trimmed;
  const host = at >= 0 ? trimmed.slice(at + 1) : "";
  return {
    type: "email",
    value: trimmed,
    raw,
    parts: { local, host, domain: host ? registrableDomain(host) : undefined },
  };
}

/** Canonicalize a phone number to India-first E.164 (best-effort, no external dep). */
export function normalizePhone(raw: string): Entity {
  const hadPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/[^\d]/g, "");
  if (!hadPlus) {
    if (digits.length === 10) digits = `91${digits}`; // bare Indian mobile
    else if (digits.length === 11 && digits.startsWith("0")) digits = `91${digits.slice(1)}`;
  }
  const e164 = `+${digits}`;
  return { type: "phone", value: e164, raw, parts: { e164 } };
}

/** Canonicalize a UPI VPA or full intent URI (upi://pay?pa=vpa@psp&...). */
export function normalizeUpi(raw: string): Entity {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Full UPI intent URI — extract the VPA from the pa= parameter.
  if (lower.startsWith("upi://")) {
    try {
      const url = new URL(lower);
      const pa = url.searchParams.get("pa");
      if (pa) {
        const at = pa.lastIndexOf("@");
        const psp = at >= 0 ? pa.slice(at + 1) : undefined;
        return { type: "upi", value: pa, raw: trimmed, parts: { psp } };
      }
    } catch {
      // fall through to plain-VPA parsing
    }
  }

  const at = lower.lastIndexOf("@");
  const psp = at >= 0 ? lower.slice(at + 1) : undefined;
  return { type: "upi", value: lower, raw: trimmed, parts: { psp } };
}

/** Detect the most likely entity type from a raw string. */
export function detectType(raw: string): EntityType {
  const s = raw.trim();
  if (!s) return "text";
  if (/\s/.test(s)) return "text"; // anything with whitespace is free text
  if (EMAIL_RE.test(s)) return "email";
  if (UPI_RE.test(s) && !s.includes("..") && s.split("@")[1] && !s.split("@")[1].includes(".")) return "upi";
  if (URLISH_RE.test(s)) return "url";
  if (DOMAIN_RE.test(s)) return "domain";
  if (PHONE_RE.test(s) && (s.match(/\d/g)?.length ?? 0) >= 6) return "phone";
  return "text";
}

/** Map an incoming ScanType to its expected entity type (QR is auto-detected). */
function hintFor(scanType: ScanType, content: string): EntityType {
  switch (scanType) {
    case "url":
      return "url";
    case "email":
      // The email scanner passes a composed blob (From/Subject/body), not a bare
      // address — only treat it as an email entity when it actually is one.
      return detectType(content) === "email" ? "email" : "text";
    case "phone":
      return "phone";
    case "upi":
      return "upi";
    case "qr":
      return detectType(content);
    case "message":
    case "screenshot":
    default:
      return "text";
  }
}

/** Normalize raw content of a known entity type into a canonical Entity. */
export function normalizeAs(type: EntityType, raw: string): Entity {
  switch (type) {
    case "url":
      return normalizeUrl(raw);
    case "domain":
      return normalizeDomain(raw);
    case "email":
      return normalizeEmail(raw);
    case "phone":
      return normalizePhone(raw);
    case "upi":
      return normalizeUpi(raw);
    case "ip":
      return normalizeDomain(raw);
    case "text":
    default:
      return { type: "text", value: raw.trim(), raw, parts: {} };
  }
}

/** Primary entry for the orchestrator: build the canonical entity for a scan. */
export function entityFromScan(scanType: ScanType, content: string): Entity {
  return normalizeAs(hintFor(scanType, content), content);
}

/**
 * Parse a UPI payment intent URI.
 * Handles both full URIs (upi://pay?pa=...) and bare query strings (pa=...).
 * Returns null when the input is not a UPI intent.
 */
export function parseUpiIntent(raw: string): { pa?: string; pn?: string; am?: string; tn?: string } | null {
  if (!raw) return null;
  try {
    const urlStr = raw.startsWith("upi://") ? raw : (raw.startsWith("pa=") ? `upi://pay?${raw}` : null);
    if (!urlStr) return null;
    const url = new URL(urlStr);
    const pa = url.searchParams.get("pa") ?? undefined;
    const pn = url.searchParams.get("pn") ?? undefined;
    const am = url.searchParams.get("am") ?? undefined;
    const tn = url.searchParams.get("tn") ?? undefined;
    if (!pa && !pn) return null;
    return { pa, pn, am, tn };
  } catch {
    return null;
  }
}

/** Sub-entities (links / UPI IDs / emails / phones) found inside free text. */
export interface ExtractedEntities {
  urls: string[];
  upis: string[];
  emails: string[];
  phones: string[];
}

// Negative lookbehind keeps us from matching the domain part of an email/UPI handle
// (e.g. the "gmail.com" in "me@gmail.com") as a standalone URL.
const URL_EXTRACT_RE = /(?<![\w@.])((?:https?:\/\/|www\.)[^\s<>"')]+|[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"')]*)?)/gi;
const TOKEN_AT_RE = /\b[a-z0-9._-]{2,256}@[a-z0-9.-]{2,64}\b/gi;
// India-first phone extraction: matches +91/0 prefix variants and bare 10-digit numbers starting with 6-9.
// Negative lookahead excludes @ so UPI VPAs (9876543210@paytm) are not double-counted as phones.
const PHONE_EXTRACT_RE = /(?<![/@\d])(?:\+91[-\s]?|91[-\s]?|0)?[6-9]\d{9}(?![\d@])/g;

/** Pull URLs, UPI IDs, emails, and phone numbers out of a block of text (deduped, normalized). */
export function extractEntities(text: string): ExtractedEntities {
  const urls = new Set<string>();
  const upis = new Set<string>();
  const emails = new Set<string>();
  const phones = new Set<string>();

  for (const m of text.matchAll(URL_EXTRACT_RE)) {
    const candidate = m[1];
    if (candidate.includes("@")) continue;
    if (/[a-z0-9-]+\.[a-z]{2,}/i.test(candidate)) urls.add(candidate.replace(/[.,);]+$/, ""));
  }

  for (const m of text.matchAll(TOKEN_AT_RE)) {
    const token = m[0].toLowerCase();
    const suffix = token.split("@")[1] ?? "";
    if (suffix.includes(".")) emails.add(token);
    else if (UPI_RE.test(token)) upis.add(token);
  }

  for (const m of text.matchAll(PHONE_EXTRACT_RE)) {
    const raw = m[0].replace(/[-\s]/g, "");
    // Skip if the matched digits are part of a URL or look like a pin/amount
    if (raw.length >= 10 && raw.length <= 13) phones.add(raw);
  }

  return { urls: [...urls], upis: [...upis], emails: [...emails], phones: [...phones] };
}
