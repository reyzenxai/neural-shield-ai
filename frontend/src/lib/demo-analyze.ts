/**
 * Frontend-only heuristic scam scorer used by the landing-page demo (no API call).
 * Tuned for Indian scam patterns (KYC, UPI, OTP, lottery, job fraud). The real,
 * LLM-backed analysis lives in the backend and arrives in Phase 3.
 */

export type DemoRiskLevel = "safe" | "suspicious" | "dangerous" | "critical";

export type DemoFlag = {
  label: string;
  severity: "info" | "warning" | "danger";
};

export type DemoResult = {
  scamProbability: number; // 0–100
  trustScore: number; // 0–100
  riskLevel: DemoRiskLevel;
  scamType: string;
  flags: DemoFlag[];
  recommendation: string;
};

type Rule = {
  test: RegExp;
  weight: number;
  flag: DemoFlag;
  type?: string;
};

const RULES: Rule[] = [
  {
    test: /\b(kyc|re-?kyc|aadhaar|aadhar|pan card)\b/i,
    weight: 26,
    type: "Fake KYC",
    flag: { label: "Asks to update KYC / Aadhaar outside an official app", severity: "danger" },
  },
  {
    test: /\b(otp|cvv|pin|password|upi pin|mpin)\b/i,
    weight: 32,
    type: "UPI / OTP fraud",
    flag: { label: "Requests OTP, PIN or CVV — never share these", severity: "danger" },
  },
  {
    test: /(bit\.ly|tinyurl|t\.co|cutt\.ly|rb\.gy|is\.gd|\.xyz|\.top|\.win|\.click)/i,
    weight: 24,
    flag: { label: "Shortened or suspicious link hides its real destination", severity: "danger" },
  },
  {
    test: /\b(block(ed)?|suspend(ed)?|deactivat|expire|within 24 ?h|immediately|urgent|act now|last warning)\b/i,
    weight: 16,
    flag: { label: "Artificial urgency / threat to pressure you", severity: "warning" },
  },
  {
    test: /\b(sbi|hdfc|icici|axis|paytm|phonepe|google ?pay|gpay|npci|trai|income tax)\b/i,
    weight: 14,
    flag: { label: "Impersonates a known bank / authority", severity: "warning" },
  },
  {
    test: /\b(lottery|prize|won|winner|lucky draw|kbc|reward|gift|cashback)\b/i,
    weight: 22,
    type: "Lottery / prize scam",
    flag: { label: "Prize / lottery bait you never entered", severity: "danger" },
  },
  {
    test: /\b(work from home|part[- ]?time job|earn ₹?\d|daily income|registration fee|joining fee)\b/i,
    weight: 20,
    type: "Job fraud",
    flag: { label: "Job offer with up-front fee — a classic job scam", severity: "danger" },
  },
  {
    test: /\b(loan|pre-?approved|instant loan|processing fee)\b/i,
    weight: 16,
    type: "Loan fraud",
    flag: { label: "Unsolicited loan offer requesting a fee", severity: "warning" },
  },
  {
    test: /(\bupi\b|@(ok|y|i)?bl|@paytm|@ybl|@oksbi|@okaxis|@okicici)/i,
    weight: 14,
    type: "UPI / OTP fraud",
    flag: { label: "Pushes a UPI collect / payment request", severity: "warning" },
  },
];

/** Run the heuristic scorer over arbitrary text. */
export function demoAnalyze(text: string): DemoResult {
  const matched = RULES.filter((r) => r.test.test(text));
  const raw = matched.reduce((sum, r) => sum + r.weight, 0);
  // Stacking bonus when several independent signals fire together.
  const stack = matched.length >= 3 ? 10 : 0;
  const scamProbability = Math.max(3, Math.min(98, raw + stack));
  const trustScore = 100 - scamProbability;

  const riskLevel: DemoRiskLevel =
    scamProbability >= 80
      ? "critical"
      : scamProbability >= 55
        ? "dangerous"
        : scamProbability >= 30
          ? "suspicious"
          : "safe";

  const scamType = matched.find((r) => r.type)?.type ?? (matched.length ? "Mixed fraud signals" : "No scam detected");

  const flags: DemoFlag[] = matched.length
    ? matched.map((r) => r.flag)
    : [
        { label: "No known scam patterns matched", severity: "info" },
        { label: "Tone and structure look consistent with a genuine message", severity: "info" },
      ];

  const recommendation =
    riskLevel === "critical" || riskLevel === "dangerous"
      ? "Do NOT share any OTP, PIN or personal details. Do not click the link. Block and report the sender."
      : riskLevel === "suspicious"
        ? "Be careful. Verify the sender through an official app or helpline before responding."
        : "Looks safe — but always confirm money requests through an independent channel.";

  return { scamProbability, trustScore, riskLevel, scamType, flags, recommendation };
}

/** Hardcoded samples the demo cycles through (Indian scam patterns). */
export const DEMO_SAMPLES: string[] = [
  "Dear customer, your SBI account will be BLOCKED today. Complete KYC immediately at bit.ly/sbi-kyc-verify or your account will be suspended.",
  "Congratulations! Your number has WON ₹25,00,000 in the KBC Lucky Draw. To claim your prize, share your UPI PIN and pay ₹2,500 registration fee.",
  "Hi, I'm from HR. We have a part-time work-from-home job, earn ₹3000 daily. Pay a small ₹499 joining fee to register and start today.",
  "Hey, are we still on for the 7pm movie on Saturday? Booked the tickets already.",
];
