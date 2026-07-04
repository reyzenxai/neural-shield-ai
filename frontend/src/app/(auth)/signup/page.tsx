"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MailCheck } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/Label";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { useAuth } from "@/hooks/useAuth";
import { scorePassword } from "@/lib/password";

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!scorePassword(password).valid)
      return setError("Password must be 8+ chars with an uppercase, a lowercase, and a number.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!accepted) return setError("Please accept the Terms of Service to continue.");

    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (needsEmailConfirmation) {
        setConfirmSent(true);
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <div className="glass-strong rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it
          to activate your account, then sign in.
        </p>
        <Button asChild variant="secondary" size="md" className="mt-6">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-3xl p-7 sm:p-8">
      <h1 className="font-display text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Start with 10 free scans a day. No card required.
      </p>

      <div className="mt-6">
        <OAuthButtons />
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or sign up with email
        <span className="h-px flex-1 bg-border" />
      </div>

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ananya Sharma"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
          />
          <PasswordStrength password={password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
          />
          {confirm.length > 0 && confirm !== password && (
            <p className="text-xs text-danger">Passwords do not match.</p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
          <Checkbox
            className="mt-0.5"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {!loading && (
            <>
              Create account <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
