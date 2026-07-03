import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - Neural Shield AI",
  description: "Terms and conditions for using Neural Shield AI.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <Link href="/" className="mb-8 inline-block text-sm text-primary hover:underline">← Back to home</Link>

      <h1 className="mb-2 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-10 text-sm text-muted-foreground">Last updated: June 24, 2025</p>

      <div className="prose prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground/80">

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">1. Acceptance</h2>
          <p>By creating an account or using Neural Shield AI ("Service"), you agree to these Terms. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">2. What the Service Does</h2>
          <p>Neural Shield AI analyses digital content (messages, URLs, emails, QR codes, phone numbers, UPI IDs, screenshots) and returns a risk assessment. Results are informational only - they are not legal, financial, or law-enforcement advice. You remain responsible for your own decisions.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">3. Accounts</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You must be at least 13 years old to use the Service.</li>
            <li>You are responsible for keeping your password secure.</li>
            <li>You must provide accurate information when registering.</li>
            <li>One account per person - do not share accounts.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5 mt-2">
            <li>Submit content you do not have permission to share.</li>
            <li>Use the Service to scan content for the purpose of making scams more effective.</li>
            <li>Attempt to reverse-engineer, bypass, or abuse our rate limits or detection systems.</li>
            <li>Resell or redistribute API access without a written agreement.</li>
            <li>Automate scans at a scale that exceeds your plan limits.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">5. Plans and Payments</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Free plan users get a limited number of daily scans as shown on the pricing page.</li>
            <li>Paid plans are billed monthly via Razorpay. Prices are shown in INR.</li>
            <li>We do not offer refunds for partial months. You can cancel any time and retain access until the end of the billing period.</li>
            <li>We reserve the right to change pricing with 30 days' notice.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">6. Disclaimer of Warranties</h2>
          <p>The Service is provided "as is". We do not guarantee that every scam will be detected or that every flagged item is actually fraudulent. Detection accuracy depends on the quality of input and available threat intelligence. Do not rely solely on our results before making financial decisions.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">7. Limitation of Liability</h2>
          <p>To the maximum extent permitted by applicable Indian law, Neural Shield AI shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, including any financial losses resulting from reliance on scan results.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">8. Termination</h2>
          <p>We may suspend or terminate accounts that violate these Terms. You may delete your account at any time from your Profile page. Upon deletion, your scan data is removed from our systems.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">9. Governing Law</h2>
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">10. Contact</h2>
          <p>Questions about these Terms? Email us at <a href="mailto:pranjal2876@gmail.com" className="text-primary hover:underline">pranjal2876@gmail.com</a>.</p>
        </section>

      </div>
    </div>
  );
}
