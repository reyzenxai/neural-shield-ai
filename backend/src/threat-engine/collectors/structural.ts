/**
 * Structural URL/domain heuristics (docs/evidence-collection-layer.md §3.1).
 *
 * Local-only and deterministic — no network — so it ships in Week 1. The network
 * collectors (DNS/RDAP/TLS/redirect) and threat-intel sources land in Week 2.
 */

import { registrableDomain } from "../normalize";
import { signalFrom } from "../config/weights";
import type { Entity, Signal } from "../types";

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "rb.gy", "is.gd", "goo.gl", "ow.ly",
  "buff.ly", "shorturl.at", "t.ly", "rebrand.ly", "bl.ink", "clck.ru", "v.gd", "shorte.st",
]);

const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "win", "click", "gq", "tk", "ml", "cf", "ga", "loan", "work", "zip", "mov", "country", "men",
]);

/** Brand tokens whose presence in a *subdomain* (not the registrable label) is a red flag. */
const BRAND_TOKENS = new Set([
  "sbi", "hdfc", "icici", "axis", "kotak", "paytm", "phonepe", "gpay", "googlepay", "npci",
  "amazon", "flipkart", "paypal", "netflix", "instagram", "facebook", "whatsapp",
  "microsoft", "apple", "google", "irctc", "epfo", "incometax", "uidai", "aadhaar",
]);

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Emit structural signals for a URL/domain entity. Fails open: returns [] for a
 * non-URL/domain entity or when the host can't be derived.
 */
export function collectStructural(entity: Entity, fromSubEntity = false): Signal[] {
  if (entity.type !== "url" && entity.type !== "domain") return [];
  const host = entity.parts.host ?? entity.value;
  if (!host) return [];

  const signals: Signal[] = [];
  const domain = entity.parts.domain ?? registrableDomain(host);
  const tld = entity.parts.tld ?? (domain.includes(".") ? domain.split(".").pop() : undefined);

  const sub = (id: string, conf: number, evidence?: Record<string, unknown>): void => {
    signals.push(signalFrom(id, "structural", conf, evidence, fromSubEntity));
  };

  if (SHORTENERS.has(domain)) sub("infra.shortener", 0.9, { host });
  if (IPV4_RE.test(host)) sub("infra.host_is_ip", 0.9, { host });
  if (host.includes("xn--")) sub("infra.punycode_homoglyph", 0.9, { host });
  if (tld && SUSPICIOUS_TLDS.has(tld)) sub("infra.suspicious_tld", 0.7, { tld });

  // Brand name in a subdomain while the registrable label is something else.
  const domainMainLabel = domain.split(".")[0];
  const subLabels = host.replace(`.${domain}`, "").split(".").filter(Boolean);
  const brandHit = subLabels.find((l) => BRAND_TOKENS.has(l) && l !== domainMainLabel);
  if (brandHit) sub("infra.brand_in_subdomain", 0.8, { brand: brandHit, host });

  // Subdomain depth (labels before the registrable domain).
  const depth = host.split(".").length - domain.split(".").length;
  if (depth >= 3) sub("infra.excessive_subdomains", 0.7, { depth });

  if (entity.raw.includes("@") && entity.type === "url") sub("infra.at_symbol_in_url", 0.85);
  if (entity.parts.scheme === "http") sub("infra.no_tls", 0.6);

  return signals;
}
