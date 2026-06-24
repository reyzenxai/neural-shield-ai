/**
 * Versioned scoring configuration — the single source of truth for the scoring
 * matrix (docs/scoring-matrix.md). Weights are DATA, not logic: the rule engine and
 * risk engine look weights up by signal id here, so tuning never touches code paths.
 *
 * Bump ENGINE_VERSION on every weight change so verdicts stay reproducible.
 */

import type { OverrideKind, Signal, SignalCategory, SourceId, SourceTier } from "../types";

export const ENGINE_VERSION = "trust-engine@2.1.1";

/** Per-category caps for positive (risk-raising) contributions (docs/scoring-matrix.md §1). */
export const CATEGORY_CAPS: Record<SignalCategory, number> = {
  blocklist: 60,
  domain_age: 30,
  infra: 30,
  content: 35,
  identity: 30,
  reputation: 50,
  pay: 35,
};

/** Source-tier reliability multipliers (docs/threat-intelligence.md §3). */
export const TIER_MULTIPLIER: Record<SourceTier, number> = { 1: 1.0, 2: 0.7, 3: 0.5 };

/** Risk-band thresholds on R (docs/trust-engine-architecture.md §7). */
export const BAND_THRESHOLDS = { critical: 80, high: 50, medium: 20, low: 5 } as const;

/** Confidence component weights (docs/trust-engine-architecture.md §5). */
export const CONFIDENCE_WEIGHTS = { coverage: 0.45, reliability: 0.25, agreement: 0.3 } as const;

/** Guards for the malicious hard override. */
export const MALICIOUS_OVERRIDE_MIN_CONFIDENCE = 0.9;
export const ALLOWLIST_RISK_CAP = 10;

export interface WeightDef {
  category: SignalCategory;
  /** Signed base weight (+ risk, − trust). */
  weight: number;
  tier: SourceTier;
  /** Human-readable label, surfaced as a flag + used in the templated explanation. */
  label: string;
  override?: OverrideKind;
}

/**
 * The matrix. Keys are stable signal ids. Bump ENGINE_VERSION on any change.
 */
export const WEIGHTS: Record<string, WeightDef> = {
  // ── content (docs/scoring-matrix.md §3.4) — cap 35 ──
  "content.credential_request": { category: "content", weight: 32, tier: 3, label: "Requests OTP, PIN, CVV or password — never share these" },
  "content.kyc_request": { category: "content", weight: 26, tier: 3, label: "Asks you to update KYC / Aadhaar / PAN outside an official app" },
  "content.urgency_threat": { category: "content", weight: 16, tier: 3, label: "Artificial urgency / threat to pressure you" },
  "content.lottery_prize": { category: "content", weight: 22, tier: 3, label: "Prize / lottery bait you never entered" },
  "content.job_upfront_fee": { category: "content", weight: 20, tier: 3, label: "Job offer asking for an up-front fee" },
  "content.loan_unsolicited": { category: "content", weight: 16, tier: 3, label: "Unsolicited loan offer requesting a fee" },
  "content.payment_pressure": { category: "content", weight: 18, tier: 3, label: "Pressure to pay now to avoid a consequence" },
  "content.too_good_returns": { category: "content", weight: 20, tier: 3, label: "Guaranteed / unrealistic returns — classic investment fraud" },
  "content.contact_offplatform": { category: "content", weight: 12, tier: 3, label: "Pushes you to move to WhatsApp / Telegram" },
  "content.attachment_or_apk": { category: "content", weight: 24, tier: 3, label: "Asks you to install an APK / open an attachment" },

  // ── infrastructure / URL structure (docs/scoring-matrix.md §3.3) — cap 30 ──
  "infra.shortener": { category: "infra", weight: 24, tier: 3, label: "Shortened link hides its real destination" },
  "infra.host_is_ip": { category: "infra", weight: 22, tier: 3, label: "Link uses a raw IP address instead of a domain" },
  "infra.punycode_homoglyph": { category: "infra", weight: 28, tier: 3, label: "Lookalike (punycode) domain impersonating a real one" },
  "infra.brand_in_subdomain": { category: "infra", weight: 20, tier: 3, label: "Brand name placed in the subdomain to look official" },
  "infra.suspicious_tld": { category: "infra", weight: 14, tier: 3, label: "Suspicious top-level domain (.xyz/.top/.win/.click…)" },
  "infra.excessive_subdomains": { category: "infra", weight: 10, tier: 3, label: "Unusually deep subdomain nesting" },
  "infra.at_symbol_in_url": { category: "infra", weight: 16, tier: 3, label: "'@' in the URL can mask the true destination" },
  "infra.no_tls": { category: "infra", weight: 14, tier: 3, label: "Insecure http:// link (no TLS)" },
  "infra.redirect_chain_long": { category: "infra", weight: 18, tier: 3, label: "Link redirects through several hops to hide its destination" },
  "infra.tls_self_signed": { category: "infra", weight: 18, tier: 3, label: "Site uses a self-signed / invalid TLS certificate" },
  "infra.tls_cn_mismatch": { category: "infra", weight: 16, tier: 3, label: "TLS certificate does not match the site's domain" },
  "infra.via_qr_code": { category: "infra", weight: 5, tier: 3, label: "Content arrived via QR code — destination was hidden before scanning" },

  // ── identity / impersonation (docs/scoring-matrix.md §3.5) — cap 30 ──
  "identity.brand_impersonation": { category: "identity", weight: 14, tier: 3, label: "Impersonates a known bank / authority" },
  "identity.sender_domain_mismatch": { category: "identity", weight: 24, tier: 3, label: "Sender domain doesn't match the brand it claims" },
  "identity.free_email_for_company": { category: "identity", weight: 12, tier: 3, label: "Uses a free email provider while claiming to be a company" },

  // ── payment instrument (docs/scoring-matrix.md §3.6) — cap 35 ──
  "pay.upi_unknown_psp": { category: "pay", weight: 18, tier: 3, label: "UPI handle uses an unknown payment provider" },
  "pay.upi_brand_impersonation": { category: "pay", weight: 22, tier: 3, label: "UPI ID impersonates a brand (e.g. 'sbi.refund@…')" },
  "pay.collect_request_unsolicited": { category: "pay", weight: 14, tier: 3, label: "Unsolicited UPI collect / money request — never approve unexpected payment requests" },
  "pay.upi_intent_name_mismatch": { category: "pay", weight: 16, tier: 3, label: "UPI payee name claims a brand but the VPA doesn't match that brand's PSP" },

  // ── phone ──
  "phone.intl_claiming_indian_bank": { category: "identity", weight: 20, tier: 2, label: "Non-Indian phone number paired with an Indian bank brand claim" },
  "phone.premium_rate_prefix": { category: "content", weight: 35, tier: 1, label: "Premium-rate or suspicious phone number prefix" },
  "phone.suspicious_sequence": { category: "content", weight: 20, tier: 2, label: "Phone number with suspicious repeated or sequential digits" },

  // ── threat-intel / blocklist (docs/scoring-matrix.md §3.1) — Week 2 collectors ──
  "ti.gsb.malware": { category: "blocklist", weight: 100, tier: 1, label: "On Google Safe Browsing malware list", override: "malicious" },
  "ti.gsb.social_engineering": { category: "blocklist", weight: 100, tier: 1, label: "On Google Safe Browsing phishing list", override: "malicious" },
  "ti.phishtank.verified": { category: "blocklist", weight: 100, tier: 1, label: "Verified phishing URL (PhishTank)", override: "malicious" },
  "ti.urlhaus.malware": { category: "blocklist", weight: 100, tier: 1, label: "Known malware-distribution URL (URLHaus)", override: "malicious" },
  "ti.openphish.match": { category: "blocklist", weight: 100, tier: 1, label: "Active phishing URL (OpenPhish)", override: "malicious" },
  "ti.virustotal.ratio_high": { category: "blocklist", weight: 45, tier: 2, label: "Flagged by multiple security engines (VirusTotal)" },
  "ti.virustotal.ratio_low": { category: "blocklist", weight: 18, tier: 2, label: "Flagged by a few security engines (VirusTotal)" },
  "ti.spamhaus.dbl": { category: "blocklist", weight: 40, tier: 1, label: "Domain on the Spamhaus block list" },
  "ti.spamhaus.zen": { category: "blocklist", weight: 30, tier: 1, label: "Hosting IP on the Spamhaus block list" },
  "ti.abuseipdb.high": { category: "blocklist", weight: 25, tier: 2, label: "Hosting IP has high abuse reports (AbuseIPDB)" },
  "ti.abuseipdb.low": { category: "blocklist", weight: 12, tier: 2, label: "Hosting IP has some abuse reports (AbuseIPDB)" },

  // ── domain age (docs/scoring-matrix.md §3.2) — Week 2 (RDAP) ──
  "domain.age_lt_7d": { category: "domain_age", weight: 30, tier: 1, label: "Domain registered in the last 7 days" },
  "domain.age_lt_30d": { category: "domain_age", weight: 25, tier: 1, label: "Domain registered in the last 30 days" },
  "domain.age_lt_90d": { category: "domain_age", weight: 15, tier: 1, label: "Domain registered in the last 90 days" },
  "domain.age_lt_1y": { category: "domain_age", weight: 6, tier: 1, label: "Domain less than a year old" },

  // ── DNS signals ──
  "domain.low_ttl": { category: "domain_age", weight: 8, tier: 2, label: "Very short DNS TTL — domain IP may be rotated frequently" },
  "domain.sinkholed": { category: "blocklist", weight: 30, tier: 1, label: "Domain resolves to a known sinkhole or null-route IP" },
  "domain.no_mx_yet_emails": { category: "identity", weight: 8, tier: 2, label: "Domain has no MX record but appears in email context" },

  // ── community / reputation (docs/scoring-matrix.md §3.7) — Week 3 ──
  "reputation.community_abuse": { category: "reputation", weight: 50, tier: 2, label: "Reported as a scam by the community" },
  "reputation.prior_scam_verdict": { category: "reputation", weight: 30, tier: 2, label: "Previously confirmed as a scam" },
  "reputation.community_override": { category: "reputation", weight: 100, tier: 1, label: "Confirmed scam by multiple trusted reports", override: "malicious" },

  // ── negative / trust signals (docs/scoring-matrix.md §4) ──
  "identity.verified_org": { category: "identity", weight: -40, tier: 1, label: "Verified organization", override: "allowlist" },
  "reputation.trusted_domain": { category: "reputation", weight: -30, tier: 1, label: "Trusted, well-established domain", override: "allowlist" },
  "domain.age_gt_5y": { category: "domain_age", weight: -20, tier: 1, label: "Long-established domain (5+ years)" },
  "domain.age_gt_2y": { category: "domain_age", weight: -10, tier: 1, label: "Established domain (2+ years)" },
  "identity.spf_dkim_dmarc_pass": { category: "identity", weight: -12, tier: 1, label: "Sender passed email authentication (SPF/DKIM/DMARC)" },
  "reputation.clean_history": { category: "reputation", weight: -15, tier: 2, label: "Clean history, no abuse reports" },
};

/** Construct a Signal from a matrix id. Throws on an unknown id (fail fast in tests). */
export function signalFrom(
  id: string,
  source: SourceId,
  confidence: number,
  evidence?: Record<string, unknown>,
  fromSubEntity = false,
): Signal {
  const def = WEIGHTS[id];
  if (!def) throw new Error(`Unknown signal id "${id}" — add it to WEIGHTS (scoring-matrix.md)`);
  return {
    id,
    category: def.category,
    weight: def.weight,
    confidence,
    label: def.label,
    source,
    sourceTier: def.tier,
    override: def.override,
    evidence,
    fromSubEntity,
  };
}
