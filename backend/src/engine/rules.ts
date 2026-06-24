/**
 * Module C — deterministic Rule Engine (docs/scoring-matrix.md §3.4–§3.6).
 *
 * Ports and extends the heuristics in frontend/src/lib/demo-analyze.ts into typed
 * Signals whose weights come from the versioned matrix (config/weights.ts). The rules
 * here cover *content/identity/payment/phone* signals; URL *infrastructure* signals
 * come from the structural collector so nothing is double-counted.
 */

import { signalFrom } from "./config/weights";
import { normalizeUpi, parseUpiIntent } from "./normalize";
import type { Entity, Signal } from "./types";

interface ContentRule {
  id: string;
  test: RegExp;
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

/** Brand / authority impersonation tokens. */
export const BRAND_RE = /\b(sbi|hdfc|icici|axis|kotak|paytm|phonepe|google ?pay|gpay|npci|trai|income ?tax|epfo|uidai|irctc|amazon|flipkart|netflix|microsoft|apple|paypal|rbi)\b/i;

/** Maps brand tokens to their canonical sending domains. */
const BRAND_DOMAINS: Record<string, string[]> = {
  sbi: ["sbi.co.in", "onlinesbi.sbi", "sbibank.in"],
  hdfc: ["hdfcbank.com", "hdfc.com"],
  icici: ["icicibank.com"],
  axis: ["axisbank.com"],
  kotak: ["kotak.com", "kotakbank.com"],
  paytm: ["paytm.com"],
  phonepe: ["phonepe.com"],
  gpay: ["google.com", "googlepay.com"],
  googlepay: ["google.com", "googlepay.com"],
  npci: ["npci.org.in"],
  trai: ["trai.gov.in"],
  incometax: ["incometaxindia.gov.in", "incometax.gov.in"],
  epfo: ["epfindia.gov.in", "epfo.gov.in"],
  uidai: ["uidai.gov.in"],
  irctc: ["irctc.co.in", "irctc.com"],
  amazon: ["amazon.in", "amazon.com"],
  flipkart: ["flipkart.com"],
  netflix: ["netflix.com"],
  microsoft: ["microsoft.com", "microsoftonline.com"],
  apple: ["apple.com", "icloud.com"],
  paypal: ["paypal.com"],
  rbi: ["rbi.org.in"],
};

/** Free-email providers (identity.free_email_for_company). */
const FREE_EMAIL_PROVIDERS = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com", "ymail.com", "proton.me"]);

/** Known-good UPI PSP suffixes; anything else is "unknown PSP". */
const KNOWN_PSP = new Set([
  "oksbi", "okhdfcbank", "okicici", "okaxis", "paytm", "ybl", "ibl", "axl", "apl", "abfspay",
  "sbi", "hdfcbank", "icici", "axisbank", "upi", "barodampay", "kotak", "yapl", "fbl", "jupiteraxis",
  "navi", "slice", "indus", "pnb", "bob", "cub", "federal", "kvb", "rbl", "dcb", "ujjivan",
]);

/** Known official PSPs per brand used for UPI intent mismatch detection. */
const BRAND_PSPS: Record<string, string[]> = {
  sbi: ["oksbi", "sbi"],
  hdfc: ["okhdfcbank", "hdfcbank"],
  icici: ["okicici", "icici"],
  axis: ["okaxis", "axisbank"],
  paytm: ["paytm"],
  phonepe: ["ybl", "ibl"],
  amazon: ["apl", "amazon"],
  gpay: ["oksbi", "okhdfcbank", "okicici", "okaxis"],
};

/** Collect request scam patterns — fire when UPI context includes an incoming request. */
const COLLECT_REQUEST_RE = /\b(collect request|collect money|approve|accept payment|receive ₹|pay request|money request|pending collect|debit request)\b/i;

/** Scam-keyword patterns that are suspicious in a UPI handle regardless of brand. */
const HANDLE_SCAM_RE = /\b(prize|winner|lottery|lucky|reward|refund|cashback|kyc|verify|verification|support|helpdesk|helpline|care|bonus|free|gift|claim)\b/i;

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

    // ── identity: sender domain doesn't match the brand it claims ──
    const senderDomain = entity.parts.domain;
    const match = BRAND_RE.exec(text);
    if (match) {
      const brandKey = match[1].toLowerCase().replace(/\s/g, "");
      const expectedDomains = BRAND_DOMAINS[brandKey] ?? BRAND_DOMAINS[brandKey.replace("googlepay", "gpay")];
      if (expectedDomains) {
        const domainOk = expectedDomains.some((d) => senderDomain === d || senderDomain.endsWith(`.${d}`));
        if (!domainOk && !FREE_EMAIL_PROVIDERS.has(senderDomain)) {
          // Only fire if not already caught by free_email_for_company (that's a stronger signal)
          signals.push(signalFrom("identity.sender_domain_mismatch", "rule_engine", 0.8, {
            claimedBrand: match[1],
            senderDomain,
          }));
        }
      }
    }
  }

  // ── payment-instrument rules for UPI entities ──
  if (entity.type === "upi") {
    signals.push(...runUpiRules(entity, text));
  }

  // ── phone-specific rules ──
  if (entity.type === "phone") {
    signals.push(...runPhoneRules(entity, text));
  }

  return signals;
}

/** UPI-specific structural rules (docs/scoring-matrix.md §3.6). */
export function runUpiRules(entity: Entity, contextText?: string): Signal[] {
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

  // ── suspicious keyword in handle regardless of brand ──
  if (HANDLE_SCAM_RE.test(handle)) {
    signals.push(signalFrom("pay.upi_suspicious_handle", "rule_engine", 0.75, { handle }));
  }

  // ── collect request: unsolicited payment pull ──
  if (contextText && COLLECT_REQUEST_RE.test(contextText)) {
    signals.push(signalFrom("pay.collect_request_unsolicited", "rule_engine", 0.75, { matched: "collect_request_context" }));
  }

  // ── UPI intent URI: payee name vs VPA mismatch ──
  const intent = parseUpiIntent(e.raw);
  if (intent?.pn && BRAND_RE.test(intent.pn)) {
    const brandMatch = BRAND_RE.exec(intent.pn);
    if (brandMatch) {
      const brandKey = brandMatch[1].toLowerCase().replace(/\s/g, "");
      const expectedPsps = BRAND_PSPS[brandKey];
      if (expectedPsps && !expectedPsps.includes(psp)) {
        signals.push(signalFrom("pay.upi_intent_name_mismatch", "rule_engine", 0.8, {
          pn: intent.pn,
          pa: intent.pa ?? e.value,
        }));
      }
    }
  }

  return signals;
}

/** Phone-specific structural rules. */
export function runPhoneRules(entity: Entity, contextText?: string): Signal[] {
  const signals: Signal[] = [];
  const digits = entity.value.replace(/\D/g, "");
  const localDigits = digits.length >= 10 ? digits.slice(-10) : digits;

  // +91 prefix but local digits don't start with 6–9 (TRAI mobile allocation)
  if (digits.startsWith("91") && digits.length === 12 && !/^91[6-9]/.test(digits)) {
    signals.push(signalFrom("phone.invalid_indian_mobile_format", "rule_engine", 0.95, { localPrefix: digits[2] }));
  }

  // Premium-rate / suspicious Indian prefixes (140x = JioFi VOIP, 900x = premium)
  if (/^91(900\d|140[0-9]|141[0-9])/.test(digits)) {
    signals.push(signalFrom("phone.premium_rate_prefix", "rule_engine", 0.8, { prefix: digits.slice(2, 6) }));
  }

  // Suspicious repeating or sequential digits
  if (localDigits.length >= 8) {
    const allSame = /^(\d)\1+$/.test(localDigits);
    const sequential = localDigits === "1234567890" || localDigits === "0987654321" || localDigits === "9876543210";
    if (allSame || sequential) {
      signals.push(signalFrom("phone.suspicious_sequence", "rule_engine", 0.75, { number: entity.value }));
    }
  }

  // Non-+91 number in a context claiming an Indian bank / authority
  if (contextText && BRAND_RE.test(contextText)) {
    const isIndian = digits.startsWith("91") && digits.length === 12;
    if (!isIndian && digits.length >= 10) {
      signals.push(signalFrom("phone.intl_claiming_indian_bank", "rule_engine", 0.7, { number: entity.value }));
    }
  }

  return signals;
}
