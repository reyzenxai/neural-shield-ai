import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Neural Shield AI",
  description: "How Neural Shield AI collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <Link href="/" className="mb-8 inline-block text-sm text-primary hover:underline">← Back to home</Link>

      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-10 text-sm text-muted-foreground">Last updated: June 24, 2025</p>

      <div className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground/80">

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">1. Who We Are</h2>
          <p>Neural Shield AI ("we", "us", "our") is a fraud and scam detection platform built for individuals and businesses in India. We are operated by Neural Shield AI and can be reached at <a href="mailto:pranjal2876@gmail.com" className="text-primary hover:underline">pranjal2876@gmail.com</a>.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">2. What Data We Collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Account data:</strong> email address, name, and plan type when you sign up.</li>
            <li><strong>Scan content:</strong> text, URLs, phone numbers, or UPI IDs you submit for analysis. We store these to show you your scan history.</li>
            <li><strong>Usage data:</strong> number of scans, scan timestamps, risk results.</li>
            <li><strong>Device data:</strong> browser type, IP address, and user agent — collected automatically for security and error monitoring (via Sentry).</li>
          </ul>
          <p className="mt-3">We do <strong>not</strong> collect passwords (handled by Supabase Auth), payment card numbers (handled by Razorpay), or biometric data.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">3. How We Use Your Data</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>To provide fraud detection results for content you submit.</li>
            <li>To show you your personal scan history.</li>
            <li>To enforce plan limits (daily scan quotas).</li>
            <li>To detect and fix errors in our service (Sentry error monitoring).</li>
            <li>To process payments via Razorpay (we never see your card details).</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">4. Data Sharing</h2>
          <p>We share your data with the following third-party services only as needed to operate the platform:</p>
          <ul className="list-disc space-y-1 pl-5 mt-2">
            <li><strong>Supabase</strong> — database and authentication (servers in EU/US).</li>
            <li><strong>Vercel</strong> — hosting and serverless functions.</li>
            <li><strong>Anthropic / OpenRouter</strong> — AI analysis (scan content sent for processing; not stored by them).</li>
            <li><strong>Sentry</strong> — error monitoring (error messages and stack traces only).</li>
            <li><strong>Razorpay</strong> — payment processing.</li>
            <li><strong>Threat Intelligence APIs</strong> (VirusTotal, Google Safe Browsing, etc.) — URLs and indicators submitted for scanning.</li>
          </ul>
          <p className="mt-3">We do not sell your data to advertisers or data brokers.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">5. Data Retention</h2>
          <p>Scan records are retained for as long as your account is active. You can delete your account at any time from your Profile page, which removes all your scan data. We may retain anonymised, aggregated statistics indefinitely.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">6. Your Rights</h2>
          <p>Under India's Digital Personal Data Protection Act 2023 (DPDPA) and applicable law, you have the right to:</p>
          <ul className="list-disc space-y-1 pl-5 mt-2">
            <li>Access the personal data we hold about you.</li>
            <li>Correct inaccurate data.</li>
            <li>Request deletion of your data.</li>
            <li>Withdraw consent at any time by deleting your account.</li>
          </ul>
          <p className="mt-3">To exercise any of these rights, email us at <a href="mailto:pranjal2876@gmail.com" className="text-primary hover:underline">pranjal2876@gmail.com</a>.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">7. Cookies</h2>
          <p>We use only essential cookies required for authentication (Supabase session cookie) and security. We do not use advertising or tracking cookies.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">8. Security</h2>
          <p>All data is encrypted in transit (TLS 1.2+) and at rest. Database access is protected by Row Level Security (RLS) — each user can only access their own data. Admin access is separately gated by role-based controls.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">9. Changes to This Policy</h2>
          <p>We may update this policy periodically. We will notify you of significant changes by email or by displaying a notice in the app. Continued use of the service after changes means you accept the updated policy.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">10. Contact</h2>
          <p>For any privacy-related questions, write to us at <a href="mailto:pranjal2876@gmail.com" className="text-primary hover:underline">pranjal2876@gmail.com</a>.</p>
        </section>

      </div>
    </div>
  );
}
