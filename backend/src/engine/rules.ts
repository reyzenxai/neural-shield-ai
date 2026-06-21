/**
 * Module C — deterministic Rule Engine (docs/scoring-matrix.md §3.4–§3.6).
 *
 * Ports and extends the heuristics in frontend/src/lib/demo-analyze.ts into typed
 * Signals whose weights come from the versioned matrix (config/weights.ts). The rules
 * here cover *content/identity/payment* signals; URL *infrastructure* signals come
 * from the structural collector so nothing is double-counted.
 */

import { signalFrom } from "./config/weights";
import { normalizeUpi } from "./normalize";
import type { Entity, Signal } from "./types";

interface ContentRule {
  /** Signal id in the scoring matrix. */
  id: string;
  test: RegExp;
  /** This rule's confidence in its own firing. */
  confidence: number;
}

/** Content/linguistic rules, run over any free text (message / email / job / SMS). */
const CONTENT_RULES: ContentRule[] = [
  { id: "content.credential_request", test: /\b(otp|cvv|pin|password|upi ?pin|mpin|one[- ]?time ?password)\b/i, confidence: 0.9 },
  { id: "content.kyc_request", test: /\b(kyc|re-?kyc|aadhaar|aadhar|pan ?card)\b/i, confidence: 0.85 },
  { id: "content.urgency_threat", test: /\b(block(ed)?|suspend(ed)?|deactivat|expire[sd]?|within 24 ?h(rs|ours)?|immediately|urgent|act now|last warning)\b/i, confidence: 0.8 },
  { id: "content.lottery_prize", test: /\b(lottery|prize|won|winner|lucky draw|kbc|reward|gift|cashback)\b/i, confidence: 0.85 },
  { id: "content.job_upfront_fee", test: /\b(work from home|part[- ]?time job|daily income|registration fee|joining fee|security deposit)\b/i, confidence: 0.85 },
  { id: "content.loan_unsolicited", test: /\b(loan|pre-?approved|instant loan|processing fee)\b/i, confidence: 0.75 },
  { id: "content.payment_pressure", test: /\b(pay (now|₹?\d)|pay to (avoid|continue|release)|fine|penalty|outstanding (due|amount))\b/i, confidence: 0.75 },
  { id: "content.too_good_returns", test: /\b(double your money|guaranteed returns?|risk[- ]?free|\d+% ?(daily|weekly|monthly) ?(return|profit)|trading signals?)\b/i, confidence: 0.8 },
  { id: "content.contact_offplatform", test: /\b(whats ?app|telegram|move (this )?(chat|conversation)|dm me|contact .{0,12}\+?\d{6,})\b/i, confidence: 0.7 },
  { id: "content.attachment_or_apk", test: /(\.apk\b|install (this|the) app|download .{0,15}(app|apk)|enable unknown sources)/i, confidence: 0.85 },
];

/** Brand / authority impersonation tokens (identity.brand_impersonation). */
const BRAND_RE = /\b(sbi|hdfc|icici|axis|kotak|paytm|phonepe|google ?pay|gpay|npci|trai|income ?tax|epfo|uidai|irctc|amazon|flipkart)\b/i;
/** Free-email providers (identity.free_email_for_company). */
const FREE_EMAIL_PROVIDERS = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com", "ymail.com", "proton.me"]);
/** Known-good UPI PSP suffixes; anything else is "unknown PSP". */
const KNOWN_PSP = new Set([
  "oksbi", "okhdfcbank", "okicici", "okaxis", "paytm", "ybl", "ibl", "axl", "apl", "abfspay",
  "sbi", "hdfcbank", "icici", "axisbank", "upi", "barodampay", "kotak", "yapl", "fbl", "jupiteraxis",
]);

/**
 * Run the rule engine over an entity and the original (untrusted) text.
 * Returns typed Signals; never throws on input.
 */
export function runRules(entity: Entity, text: string): Signal[] {
  const signals: Signal[] = [];

  // ── content rules over any text-bearing input ──
  if (text && (entity.type === "text" || entity.type === "email" || entity.type === "url")) {
    for (const rule of CONTENT_RULES) {
      if (rule.test.test(text)) signals.push(signalFrom(rule.id, "rule_engine", rule.confidence));
    }
    if (BRAND_RE.test(text)) signals.push(signalFrom("identity.brand_impersonation", "rule_engine", 0.7));
  }

  // ── identity: free-email recruiter claiming a company ──
  if (entity.type === "email" && entity.parts.domain) {
    if (FREE_EMAIL_PROVIDERS.has(entity.parts.domain) && BRAND_RE.test(text)) {
      signals.push(signalFrom("identity.free_email_for_company", "rule_engine", 0.7, { domain: entity.parts.domain }));
    }
  }

  // ── payment-instrument rules for UPI entities ──
  if (entity.type === "upi") {
    signals.push(...runUpiRules(entity));
  }

  return signals;
}

/** UPI-specific structural rules (docs/scoring-matrix.md §3.6). */
export function runUpiRules(entity: Entity): Signal[] {
  const e = entity.parts.psp ? entity : normalizeUpi(entity.value);
  const psp = e.parts.psp ?? "";
  const handle = e.value.split("@")[0] ?? "";
  const signals: Signal[] = [];

  if (psp && !KNOWN_PSP.has(psp)) {
    signals.push(signalFrom("pay.upi_unknown_psp", "rule_engine", 0.8, { psp }));
  }
  if (BRAND_RE.test(handle) && /\b(refund|kyc|verify|support|help|care|prize|bonus)\b/i.test(handle)) {
    signals.push(signalFrom("pay.upi_brand_impersonation", "rule_engine", 0.8, { handle }));
  }
  return signals;
}
