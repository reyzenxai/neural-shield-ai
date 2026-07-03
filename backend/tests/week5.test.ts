/**
 * Week 5 tests — Signal Coverage Expansion.
 * All tests are pure logic / unit tests: no network calls, no DB, no engine.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { signalFrom, WEIGHTS, ENGINE_VERSION } from "../src/threat-engine/config/weights";
import { runRules, runUpiRules, runPhoneRules, BRAND_RE } from "../src/threat-engine/rules";
import { extractEntities, parseUpiIntent, normalizeEmail, normalizePhone, normalizeUpi } from "../src/threat-engine/normalize";
import { parseVtStats } from "../src/threat-engine/intel/virustotal";
import { parseAbuseScore } from "../src/threat-engine/intel/abuseipdb";
import { checkDbl, checkZen } from "../src/threat-engine/intel/spamhaus";
import { checkSpf, checkDmarc } from "../src/threat-engine/collectors/spf";

// ─────────────────────────────────────────────────────────────────────────────
// Engine version
// ─────────────────────────────────────────────────────────────────────────────
describe("ENGINE_VERSION", () => {
  it("is bumped to 2.1.4", () => {
    assert.equal(ENGINE_VERSION, "trust-engine@2.1.4");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Dead signals activated
// ─────────────────────────────────────────────────────────────────────────────
describe("identity.sender_domain_mismatch", () => {
  it("fires when email @domain doesn't match the claimed brand", () => {
    const entity = normalizeEmail("hdfc.support@scam-site.xyz");
    const sigs = runRules(entity, "Your HDFC Bank account is blocked. Verify now.");
    const ids = sigs.map((s) => s.id);
    assert.ok(ids.includes("identity.sender_domain_mismatch"), `fired ids: ${ids.join(", ")}`);
  });

  it("does NOT fire when sender domain matches the brand", () => {
    const entity = normalizeEmail("support@hdfcbank.com");
    const sigs = runRules(entity, "Your HDFC Bank account statement is ready.");
    const ids = sigs.map((s) => s.id);
    assert.ok(!ids.includes("identity.sender_domain_mismatch"), `should not fire, got: ${ids.join(", ")}`);
  });

  it("does NOT fire for a free-email address (free_email_for_company catches that)", () => {
    const entity = normalizeEmail("hdfc.support@gmail.com");
    const sigs = runRules(entity, "Your HDFC Bank account. Click here.");
    const ids = sigs.map((s) => s.id);
    // free_email_for_company fires, sender_domain_mismatch should NOT double-fire
    assert.ok(ids.includes("identity.free_email_for_company"));
    assert.ok(!ids.includes("identity.sender_domain_mismatch"));
  });

  it("has a weight of +24 in the matrix", () => {
    assert.equal(WEIGHTS["identity.sender_domain_mismatch"].weight, 24);
  });
});

describe("pay.collect_request_unsolicited", () => {
  it("fires when context contains 'collect request'", () => {
    const entity = normalizeUpi("9876543210@paytm");
    const sigs = runUpiRules(entity, "You have a pending collect request from 9876543210@paytm. Approve?");
    const ids = sigs.map((s) => s.id);
    assert.ok(ids.includes("pay.collect_request_unsolicited"), `fired: ${ids.join(", ")}`);
  });

  it("fires when context contains 'money request'", () => {
    const entity = normalizeUpi("user@ybl");
    const sigs = runUpiRules(entity, "A money request of ₹5000 is pending. Accept payment.");
    assert.ok(sigs.some((s) => s.id === "pay.collect_request_unsolicited"));
  });

  it("does NOT fire when there is no collect-request context", () => {
    const entity = normalizeUpi("merchant@paytm");
    const sigs = runUpiRules(entity, "Please pay ₹200 to merchant@paytm for your order.");
    assert.ok(!sigs.some((s) => s.id === "pay.collect_request_unsolicited"));
  });

  it("has weight +14 in the matrix", () => {
    assert.equal(WEIGHTS["pay.collect_request_unsolicited"].weight, 14);
  });
});

describe("identity.spf_dkim_dmarc_pass", () => {
  it("has weight −12 in the matrix (trust signal)", () => {
    assert.equal(WEIGHTS["identity.spf_dkim_dmarc_pass"].weight, -12);
  });

  it("signalFrom works correctly", () => {
    const s = signalFrom("identity.spf_dkim_dmarc_pass", "dns", 0.8);
    assert.equal(s.weight, -12);
    assert.equal(s.sourceTier, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Phone entity coverage
// ─────────────────────────────────────────────────────────────────────────────
describe("phone prefix rules", () => {
  it("fires premium_rate_prefix for 9001234567 (900x pattern)", () => {
    const entity = normalizePhone("9001234567");
    const sigs = runPhoneRules(entity);
    assert.ok(sigs.some((s) => s.id === "phone.premium_rate_prefix"), `got: ${sigs.map((s) => s.id).join(", ")}`);
  });

  it("does NOT fire premium_rate_prefix for a normal mobile number", () => {
    const entity = normalizePhone("9876543210");
    const sigs = runPhoneRules(entity);
    assert.ok(!sigs.some((s) => s.id === "phone.premium_rate_prefix"));
  });

  it("fires suspicious_sequence for all-same digit number (9999999999)", () => {
    const entity = normalizePhone("9999999999");
    const sigs = runPhoneRules(entity);
    assert.ok(sigs.some((s) => s.id === "phone.suspicious_sequence"), `got: ${sigs.map((s) => s.id).join(", ")}`);
  });

  it("fires suspicious_sequence for sequential number (1234567890)", () => {
    const entity = normalizePhone("1234567890");
    const sigs = runPhoneRules(entity);
    assert.ok(sigs.some((s) => s.id === "phone.suspicious_sequence"));
  });

  it("does NOT fire suspicious_sequence for a normal number", () => {
    const entity = normalizePhone("9876012345");
    const sigs = runPhoneRules(entity);
    assert.ok(!sigs.some((s) => s.id === "phone.suspicious_sequence"));
  });

  it("fires intl_claiming_indian_bank for +1 number in text mentioning SBI", () => {
    const entity = normalizePhone("+14155550100");
    const sigs = runPhoneRules(entity, "Call SBI customer care immediately at +1 415 555 0100");
    assert.ok(sigs.some((s) => s.id === "phone.intl_claiming_indian_bank"), `got: ${sigs.map((s) => s.id).join(", ")}`);
  });

  it("does NOT fire intl_claiming_indian_bank for an Indian mobile with brand mention", () => {
    const entity = normalizePhone("9123456789");
    const sigs = runPhoneRules(entity, "HDFC Bank: your OTP is 123456");
    assert.ok(!sigs.some((s) => s.id === "phone.intl_claiming_indian_bank"));
  });

  it("all phone weights are defined correctly", () => {
    assert.equal(WEIGHTS["phone.intl_claiming_indian_bank"].weight, 20);
    assert.equal(WEIGHTS["phone.premium_rate_prefix"].weight, 35);
    assert.equal(WEIGHTS["phone.suspicious_sequence"].weight, 20);
  });
});

describe("phone extraction from text", () => {
  it("extracts 10-digit Indian mobile numbers from text", () => {
    const result = extractEntities("Call us at 9876543210 to claim your prize money.");
    assert.ok(result.phones.length >= 1, `phones: ${result.phones.join(", ")}`);
    assert.ok(result.phones.some((p) => p.includes("9876543210")));
  });

  it("extracts +91 prefixed numbers from text", () => {
    // Regex handles one separator between prefix and 10-digit number (not within the number)
    const result = extractEntities("WhatsApp us at +91 9876543210 for job offer.");
    assert.ok(result.phones.length >= 1);
  });

  it("does NOT extract email-domain digits as phone numbers", () => {
    const result = extractEntities("Contact support@company123.com for help.");
    // Should not extract 123 or any partial match
    assert.ok(result.phones.every((p) => p.length >= 10));
  });

  it("does NOT extract UPI IDs as phone numbers", () => {
    const result = extractEntities("Pay to 9876543210@paytm via UPI.");
    // UPI should go to upis, not phones (@ lookahead prevents double-counting)
    assert.ok(result.upis.some((u) => u.includes("9876543210")));
    // Phone digits followed by @ should be excluded by the negative lookahead
    assert.ok(!result.phones.some((p) => p === "9876543210"), `phones: ${result.phones.join(", ")}`);
  });

  it("returns empty phones array for text with no phone numbers", () => {
    const result = extractEntities("Click the link to verify your KYC.");
    assert.equal(result.phones.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — New TI collectors (pure parsing, no network)
// ─────────────────────────────────────────────────────────────────────────────
describe("VirusTotal parseVtStats", () => {
  it("returns [] for clean result (ratio < 10%)", () => {
    const sigs = parseVtStats({ malicious: 1, suspicious: 0, undetected: 49, harmless: 50 });
    assert.equal(sigs.length, 0);
  });

  it("returns ratio_low for 10–29% flagged", () => {
    // 10/50 = 20%
    const sigs = parseVtStats({ malicious: 8, suspicious: 2, undetected: 20, harmless: 20 });
    assert.equal(sigs.length, 1);
    assert.equal(sigs[0].id, "ti.virustotal.ratio_low");
    assert.equal(sigs[0].weight, 18);
  });

  it("returns ratio_high for ≥30% flagged", () => {
    // 35/100 = 35%
    const sigs = parseVtStats({ malicious: 30, suspicious: 5, undetected: 15, harmless: 50 });
    assert.equal(sigs.length, 1);
    assert.equal(sigs[0].id, "ti.virustotal.ratio_high");
    assert.equal(sigs[0].weight, 45);
  });

  it("returns [] for zero-engine result (no data yet)", () => {
    const sigs = parseVtStats({ malicious: 0, suspicious: 0, undetected: 0, harmless: 0 });
    assert.equal(sigs.length, 0);
  });
});

describe("AbuseIPDB parseAbuseScore", () => {
  it("returns [] for score below 20", () => {
    assert.equal(parseAbuseScore(10, "1.2.3.4").length, 0);
    assert.equal(parseAbuseScore(0, "1.2.3.4").length, 0);
  });

  it("returns ti.abuseipdb.low for score 20–49", () => {
    const sigs = parseAbuseScore(35, "1.2.3.4");
    assert.equal(sigs.length, 1);
    assert.equal(sigs[0].id, "ti.abuseipdb.low");
    assert.equal(sigs[0].weight, 12);
  });

  it("returns ti.abuseipdb.high for score ≥50", () => {
    const sigs = parseAbuseScore(75, "5.6.7.8");
    assert.equal(sigs.length, 1);
    assert.equal(sigs[0].id, "ti.abuseipdb.high");
    assert.equal(sigs[0].weight, 25);
  });

  it("returns high (not low) for boundary score 50", () => {
    const sigs = parseAbuseScore(50, "1.2.3.4");
    assert.equal(sigs[0].id, "ti.abuseipdb.high");
  });

  it("abuseipdb weights are correct in matrix", () => {
    assert.equal(WEIGHTS["ti.abuseipdb.high"].weight, 25);
    assert.equal(WEIGHTS["ti.abuseipdb.low"].weight, 12);
    assert.equal(WEIGHTS["ti.abuseipdb.high"].tier, 2);
  });
});

describe("Spamhaus weights in matrix", () => {
  it("ti.spamhaus.dbl is T1 weight 40", () => {
    assert.equal(WEIGHTS["ti.spamhaus.dbl"].weight, 40);
    assert.equal(WEIGHTS["ti.spamhaus.dbl"].tier, 1);
  });

  it("ti.spamhaus.zen is T1 weight 30", () => {
    assert.equal(WEIGHTS["ti.spamhaus.zen"].weight, 30);
    assert.equal(WEIGHTS["ti.spamhaus.zen"].tier, 1);
  });

  it("signalFrom creates correct spamhaus signals", () => {
    const dbl = signalFrom("ti.spamhaus.dbl", "spamhaus", 0.9, { domain: "evil.com" });
    assert.equal(dbl.weight, 40);
    assert.equal(dbl.sourceTier, 1);
    const zen = signalFrom("ti.spamhaus.zen", "spamhaus", 0.9, { domain: "evil.com" });
    assert.equal(zen.weight, 30);
  });
});

describe("DNS signal weights in matrix", () => {
  it("domain.low_ttl is T2 weight 8", () => {
    assert.equal(WEIGHTS["domain.low_ttl"].weight, 8);
    assert.equal(WEIGHTS["domain.low_ttl"].tier, 2);
  });

  it("domain.sinkholed is T1 weight 30", () => {
    assert.equal(WEIGHTS["domain.sinkholed"].weight, 30);
    assert.equal(WEIGHTS["domain.sinkholed"].tier, 1);
  });

  it("domain.no_mx_yet_emails is T2 weight 8", () => {
    assert.equal(WEIGHTS["domain.no_mx_yet_emails"].weight, 8);
    assert.equal(WEIGHTS["domain.no_mx_yet_emails"].tier, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — UPI intent parsing
// ─────────────────────────────────────────────────────────────────────────────
describe("parseUpiIntent", () => {
  it("parses a full upi:// URI correctly", () => {
    const result = parseUpiIntent("upi://pay?pa=9876543210@paytm&pn=HDFC+Bank+Refund&am=500&tn=KYC+fee");
    assert.ok(result !== null);
    assert.equal(result!.pa, "9876543210@paytm");
    assert.equal(result!.pn, "HDFC Bank Refund");
    assert.equal(result!.am, "500");
    assert.equal(result!.tn, "KYC fee");
  });

  it("parses a bare query string starting with pa=", () => {
    const result = parseUpiIntent("pa=merchant@oksbi&pn=My+Shop&am=100");
    assert.ok(result !== null);
    assert.equal(result!.pa, "merchant@oksbi");
  });

  it("returns null for a plain UPI ID (not an intent URI)", () => {
    assert.equal(parseUpiIntent("9876543210@paytm"), null);
  });

  it("returns null for empty string", () => {
    assert.equal(parseUpiIntent(""), null);
  });

  it("handles URL-encoded payee names", () => {
    const result = parseUpiIntent("upi://pay?pa=abc@ybl&pn=SBI%20Customer%20Care&am=1");
    assert.equal(result!.pn, "SBI Customer Care");
  });
});

describe("pay.upi_intent_name_mismatch", () => {
  it("fires when payee name claims SBI but PSP is @paytm", () => {
    const entity = normalizeUpi("upi://pay?pa=scammer@paytm&pn=SBI+Refund+Desk&am=1");
    const sigs = runUpiRules(entity);
    assert.ok(sigs.some((s) => s.id === "pay.upi_intent_name_mismatch"), `fired: ${sigs.map((s) => s.id).join(", ")}`);
  });

  it("does NOT fire when payee name and PSP both match SBI", () => {
    const entity = normalizeUpi("upi://pay?pa=merchant@oksbi&pn=SBI+Merchant&am=50");
    const sigs = runUpiRules(entity);
    assert.ok(!sigs.some((s) => s.id === "pay.upi_intent_name_mismatch"));
  });

  it("has weight +16 in the matrix", () => {
    assert.equal(WEIGHTS["pay.upi_intent_name_mismatch"].weight, 16);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — QR / infra signals
// ─────────────────────────────────────────────────────────────────────────────
describe("infra.via_qr_code", () => {
  it("is defined in the weights matrix", () => {
    assert.ok(WEIGHTS["infra.via_qr_code"] !== undefined);
  });

  it("has weight +5 in the matrix", () => {
    assert.equal(WEIGHTS["infra.via_qr_code"].weight, 5);
  });

  it("signalFrom creates correct QR signal", () => {
    const s = signalFrom("infra.via_qr_code", "rule_engine", 0.9);
    assert.equal(s.id, "infra.via_qr_code");
    assert.equal(s.weight, 5);
    assert.equal(s.category, "infra");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BRAND_RE coverage
// ─────────────────────────────────────────────────────────────────────────────
describe("BRAND_RE coverage", () => {
  it("matches new entries (rbi, netflix, microsoft, apple, paypal)", () => {
    assert.ok(BRAND_RE.test("Contact RBI for your account"));
    BRAND_RE.lastIndex = 0;
    assert.ok(BRAND_RE.test("Netflix subscription expired"));
    BRAND_RE.lastIndex = 0;
    assert.ok(BRAND_RE.test("Microsoft security alert"));
    BRAND_RE.lastIndex = 0;
    assert.ok(BRAND_RE.test("Apple ID locked"));
    BRAND_RE.lastIndex = 0;
    assert.ok(BRAND_RE.test("PayPal account suspended"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// New signals added in 2.1.3/2.1.4
// ─────────────────────────────────────────────────────────────────────────────
describe("phone.invalid_indian_mobile_format", () => {
  it("fires for a +91 number whose local digits start with 0–5", () => {
    // 2047287457 → normalizePhone adds 91 prefix → +912047287457
    // local first digit is '2', which is not 6–9 → rule fires
    const entity = normalizePhone("2047287457");
    const sigs = runPhoneRules(entity);
    assert.ok(sigs.some((s) => s.id === "phone.invalid_indian_mobile_format"),
      `expected invalid_indian_mobile_format, got: ${sigs.map((s) => s.id).join(", ")}`);
  });

  it("fires for a +91 number whose local first digit is '5'", () => {
    const entity = normalizePhone("5001234567");
    const sigs = runPhoneRules(entity);
    assert.ok(sigs.some((s) => s.id === "phone.invalid_indian_mobile_format"));
  });

  it("does NOT fire for a valid Indian mobile starting with 9", () => {
    const entity = normalizePhone("9876543210");
    const sigs = runPhoneRules(entity);
    assert.ok(!sigs.some((s) => s.id === "phone.invalid_indian_mobile_format"));
  });

  it("does NOT fire for a valid Indian mobile starting with 6", () => {
    const entity = normalizePhone("6001234567");
    const sigs = runPhoneRules(entity);
    assert.ok(!sigs.some((s) => s.id === "phone.invalid_indian_mobile_format"));
  });

  it("has weight 30 and tier 1 in the matrix", () => {
    assert.equal(WEIGHTS["phone.invalid_indian_mobile_format"].weight, 30);
    assert.equal(WEIGHTS["phone.invalid_indian_mobile_format"].tier, 1);
  });
});

describe("pay.upi_suspicious_handle", () => {
  it("fires for a handle containing a scam keyword (prize)", () => {
    const entity = normalizeUpi("prize.winner123@paytm");
    const sigs = runUpiRules(entity);
    assert.ok(sigs.some((s) => s.id === "pay.upi_suspicious_handle"),
      `expected upi_suspicious_handle, got: ${sigs.map((s) => s.id).join(", ")}`);
  });

  it("fires for a handle with 'kyc' keyword (word-boundary match)", () => {
    // "kyc" must appear as a whole word token in the handle — "kyc.update" matches, "kycupdate" does not
    const entity = normalizeUpi("kyc.update@oksbi");
    const sigs = runUpiRules(entity);
    assert.ok(sigs.some((s) => s.id === "pay.upi_suspicious_handle"),
      `expected upi_suspicious_handle, got: ${sigs.map((s) => s.id).join(", ")}`);
  });

  it("does NOT fire when brand_impersonation already covers the handle", () => {
    // sbi.refund@oksbi: has brand ("sbi") + scam word ("refund") → brand_impersonation fires,
    // upi_suspicious_handle should NOT double-fire for the same evidence
    const entity = normalizeUpi("sbi.refund@oksbi");
    const sigs = runUpiRules(entity);
    assert.ok(sigs.some((s) => s.id === "pay.upi_brand_impersonation"),
      "expected brand_impersonation to fire");
    assert.ok(!sigs.some((s) => s.id === "pay.upi_suspicious_handle"),
      "upi_suspicious_handle should not double-fire when brand_impersonation already fired");
  });

  it("does NOT fire for a clean handle", () => {
    const entity = normalizeUpi("johndoe@oksbi");
    const sigs = runUpiRules(entity);
    assert.ok(!sigs.some((s) => s.id === "pay.upi_suspicious_handle"));
  });

  it("has weight 20 and tier 2 in the matrix", () => {
    assert.equal(WEIGHTS["pay.upi_suspicious_handle"].weight, 20);
    assert.equal(WEIGHTS["pay.upi_suspicious_handle"].tier, 2);
  });
});

describe("normalizeUpi edge cases", () => {
  it("returns undefined PSP for trailing-@ handle", () => {
    const entity = normalizeUpi("handle@");
    assert.equal(entity.parts.psp, undefined);
  });

  it("extracts correct PSP for a normal VPA", () => {
    const entity = normalizeUpi("user@paytm");
    assert.equal(entity.parts.psp, "paytm");
  });
});

describe("normalizePhone 0-prefix edge cases", () => {
  it("treats 0-prefix 10-digit-local as Indian when local starts with 6–9", () => {
    const entity = normalizePhone("09876543210");
    // 11 digits, starts with 0, local = 9876543210 (starts with 9) → +919876543210
    assert.equal(entity.value, "+919876543210");
  });

  it("does NOT re-tag a 0-prefix number whose local doesn't start with 6–9", () => {
    // 01234567890 — 11 digits, starts with 0, local = 1234567890 (starts with 1, UK-like)
    const entity = normalizePhone("01234567890");
    // Should NOT be normalized to +91... — local starts with 1, not a valid Indian mobile
    assert.ok(!entity.value.startsWith("+911"), `got: ${entity.value}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression: old signals still present in matrix
// ─────────────────────────────────────────────────────────────────────────────
describe("scoring matrix regression", () => {
  const existingIds = [
    "content.credential_request", "content.kyc_request", "content.urgency_threat",
    "infra.shortener", "infra.host_is_ip", "infra.punycode_homoglyph",
    "identity.brand_impersonation", "identity.free_email_for_company",
    "pay.upi_unknown_psp", "pay.upi_brand_impersonation",
    "pay.upi_suspicious_handle", "phone.invalid_indian_mobile_format",
    "ti.gsb.malware", "ti.gsb.social_engineering",
    "ti.phishtank.verified", "ti.urlhaus.malware", "ti.openphish.match",
    "domain.age_lt_7d", "domain.age_lt_30d", "domain.age_gt_5y",
    "reputation.community_abuse", "reputation.community_override",
    "identity.verified_org", "reputation.trusted_domain", "reputation.clean_history",
  ];

  for (const id of existingIds) {
    it(`"${id}" still exists`, () => {
      assert.ok(WEIGHTS[id] !== undefined, `WEIGHTS["${id}"] is missing`);
    });
  }
});
