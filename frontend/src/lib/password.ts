/** Password validation + strength scoring shared by the signup form. */

export interface PasswordCheck {
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  /** 0-4 */
  score: number;
  label: "Too weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  checks: PasswordCheck[];
  /** meets the minimum policy (8+ chars, lower, upper, digit) */
  valid: boolean;
}

const LABELS: PasswordStrength["label"][] = [
  "Too weak",
  "Weak",
  "Fair",
  "Strong",
  "Very strong",
];

/**
 * Score a password against the signup policy used by the backend
 * (min 8 chars, at least one lowercase, uppercase, and digit).
 */
export function scorePassword(password: string): PasswordStrength {
  const checks: PasswordCheck[] = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "An uppercase letter", met: /[A-Z]/.test(password) },
    { label: "A lowercase letter", met: /[a-z]/.test(password) },
    { label: "A number", met: /\d/.test(password) },
  ];

  const required = checks.filter((c) => c.met).length;
  const bonus = password.length >= 12 || /[^A-Za-z0-9]/.test(password) ? 1 : 0;
  const score = Math.min(4, required === 4 ? 3 + bonus : required);

  // Policy requires the first four checks (8+, upper, lower, digit).
  const valid = checks.every((c) => c.met);

  return { score, label: LABELS[score], checks, valid };
}
