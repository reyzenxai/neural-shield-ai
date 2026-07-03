"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeIndianRupee,
  Brain,
  Check,
  Heart,
  Image as ImageIcon,
  Link2,
  Mail,
  MessageSquare,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Upload,
} from "lucide-react";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Navbar } from "@/components/landing/Navbar";
import { NeuralOrb } from "@/components/landing/NeuralOrb";
import { HeroScanPreview } from "@/components/landing/HeroScanPreview";
import { RiskDemo } from "@/components/landing/RiskDemo";
import { PLANS, PLAN_ORDER, planFeatureLines, type PlanId } from "@neural-shield/config";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

const SCANNERS: { icon: typeof MessageSquare; label: string }[] = [
  { icon: MessageSquare, label: "Message" },
  { icon: Link2, label: "URL" },
  { icon: Mail, label: "Email" },
  { icon: ImageIcon, label: "Screenshot" },
  { icon: QrCode, label: "QR Code" },
  { icon: Smartphone, label: "Phone" },
  { icon: BadgeIndianRupee, label: "UPI" },
];

const FEATURES = [
  { icon: MessageSquare, title: "Message Scanner", desc: "Paste any suspicious text. Get instant AI analysis." },
  { icon: Link2, title: "URL Scanner", desc: "Check links before you click. We analyze in real-time." },
  { icon: Mail, title: "Email Analyzer", desc: "Forward suspicious emails. We flag phishing attempts." },
  { icon: ImageIcon, title: "Screenshot Reader", desc: "Upload a screenshot. Our OCR extracts and analyzes text." },
  { icon: QrCode, title: "QR Code Detector", desc: "Scan malicious QR codes before they redirect you." },
  { icon: BadgeIndianRupee, title: "UPI / Phone Guard", desc: "Verify UPI IDs and phone numbers against known fraud." },
];

const STEPS = [
  { icon: Upload, title: "Paste or Upload", desc: "Drop a message, link, email, screenshot, or QR code." },
  { icon: Brain, title: "AI Analyzes", desc: "Our model reads it the way a fraud investigator would." },
  { icon: ShieldCheck, title: "Get Your Result", desc: "A clear trust score, risk level, and what to do next." },
];

const PLAN_COPY: Record<PlanId, { blurb: string; cta: string; featured?: boolean }> = {
  free: { blurb: "For everyday protection.", cta: "Get Started Free" },
  individual: { blurb: "One person, everyday peace of mind.", cta: "Choose Individual", featured: true },
  two_person: { blurb: "Cover two people you care about.", cta: "Choose Two-person" },
  family: { blurb: "Protect the whole family.", cta: "Choose Family" },
  pro: { blurb: "Everything, unlimited, all 7 scanners.", cta: "Go Pro" },
};

const TESTIMONIALS = [
  {
    quote: "It flagged a fake SBI KYC SMS aimed at my mother in two seconds. We almost fell for it.",
    name: "Ananya S.",
    city: "Jaipur",
    initials: "AS",
    color: "bg-primary/20 text-primary",
  },
  {
    quote: "Every UPI request I don't recognise now goes through Neural Shield first. Total peace of mind.",
    name: "Rahul M.",
    city: "Pune",
    initials: "RM",
    color: "bg-secondary/20 text-secondary",
  },
  {
    quote: "Caught a 'work from home' job scam asking for a ₹499 fee. Saved my cousin instantly.",
    name: "Fatima K.",
    city: "Hyderabad",
    initials: "FK",
    color: "bg-accent/20 text-accent",
  },
];

const FAQS: [string, string][] = [
  [
    "How accurate is the AI detection?",
    "Neural Shield combines LLM reasoning with India-specific scam patterns to reach high accuracy on common fraud - KYC, UPI, OTP, lottery, and job scams. It always errs on the side of caution, because a missed scam costs far more than a false alarm.",
  ],
  [
    "Is my data stored or shared?",
    "By default your content is analyzed and never sold or shared. Free scans keep a short 7-day history; paid plans keep a private scan history you control (30 days, or 60 days on Pro).",
  ],
  [
    "How do the Two-person and Family plans work?",
    "Whoever buys the plan links the other members by the email they signed up with on Neural Shield. Each member gets their own scan quota. You can change a linked email once per billing month from your profile.",
  ],
  [
    "How do I upgrade and pay?",
    "Pick a plan, pay with UPI, and upload your payment screenshot. We verify it and activate your plan. No card or wallet needed.",
  ],
  [
    "What is a Trust Score?",
    "A 0-100 score: higher means safer. It is the inverse of scam probability and is paired with a clear risk level (Safe, Suspicious, Dangerous, or Critical) plus the exact red flags we found.",
  ],
  [
    "Is there a mobile app?",
    "The web app is fully mobile-optimized today, and an Android app is on the way. Join Free to be notified first.",
  ],
];

export default function Home() {
  return (
    <div id="top" className="relative min-h-screen overflow-x-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10" />
      <Navbar />

      {/* SECTION 1 - HERO */}
      <section className="relative mx-auto max-w-6xl px-5 pb-24 pt-12 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <motion.div
              {...fadeUp}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              10,000+ scams detected · trusted across 200+ cities
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.05 }}
              className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              Stop Scams
              <br />
              <span className="text-gradient">Before They Stop You.</span>
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              AI-powered fraud detection for messages, URLs, emails, QR codes, and payments. Built
              for India.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.15 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button asChild variant="primary" size="lg" className="group">
                <a href="#demo">
                  Scan for Free
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </a>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <a href="#how">
                  <Sparkles className="h-4 w-4 text-primary" /> See How It Works
                </a>
              </Button>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.2 }}
              className="mt-10 grid max-w-md grid-cols-3 gap-6 font-mono text-xs text-muted-foreground"
            >
              <div>
                <div className="text-2xl font-semibold text-foreground">10K+</div>
                scams detected
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">1.4s</div>
                avg analysis
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">200+</div>
                cities
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroScanPreview />
          </motion.div>
        </div>

        {/* Scanner modality strip */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.3 }}
          className="mt-16 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
        >
          {SCANNERS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="glass flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs text-muted-foreground"
            >
              <Icon className="h-4 w-4 text-primary" /> {label}
            </div>
          ))}
        </motion.div>
      </section>

      {/* SECTION 2 - FEATURES */}
      <Section
        id="features"
        eyebrow="What we scan"
        title={
          <>
            Seven scanners. <span className="text-gradient">One verdict.</span>
          </>
        }
        sub="Whatever the scammers send, paste it here. Neural Shield reads it like a fraud investigator and tells you what it really is."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}>
              <Card variant="glass" interactive className="group h-full p-5">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition group-hover:ring-primary/40">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="font-display text-lg font-semibold">{f.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* SECTION 3 - HOW IT WORKS */}
      <Section
        id="how"
        eyebrow="How it works"
        title={
          <>
            Three steps to <span className="text-gradient">total clarity.</span>
          </>
        }
        sub="No setup, no jargon. From suspicious message to clear answer in seconds."
      >
        <div className="relative grid gap-6 md:grid-cols-3">
          {/* Connector line */}
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.12 }}
              className="relative text-center"
            >
              <div className="relative mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl glass-strong text-primary ring-1 ring-primary/30">
                <s.icon className={`h-6 w-6 ${i === 1 ? "animate-pulse" : ""}`} />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary font-mono text-[10px] font-semibold text-primary-foreground">
                  {i + 1}
                </span>
              </div>
              <div className="font-display text-lg font-semibold">{s.title}</div>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Decorative orb */}
        <div className="mt-8 hidden justify-center lg:flex">
          <div className="scale-75 opacity-90">
            <NeuralOrb />
          </div>
        </div>
      </Section>

      {/* SECTION 4 - RISK SCORE DEMO */}
      <Section
        id="demo"
        eyebrow="Live demo"
        title={
          <>
            Try it now. <span className="text-gradient">No sign-up.</span>
          </>
        }
        sub="Paste a suspicious message - or load a real Indian scam sample - and watch the risk score appear."
      >
        <RiskDemo />
      </Section>

      {/* SECTION 5 - PRICING */}
      <Section
        id="pricing"
        eyebrow="Pricing"
        title={
          <>
            Protection at <span className="text-gradient">every scale.</span>
          </>
        }
        sub="Start free. Upgrade the day one prevented scam is worth more than a year of protection."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLAN_ORDER.map((id, i) => {
            const plan = PLANS[id];
            const copy = PLAN_COPY[id];
            return (
              <motion.div
                key={id}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.06 }}
                className={`relative rounded-3xl p-6 ${
                  copy.featured ? "glass-strong ring-1 ring-primary/40 glow-primary" : "glass"
                }`}
              >
                {copy.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                    Most Popular
                  </span>
                )}
                <div className="font-display text-lg font-semibold">{plan.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold">₹{plan.priceInr}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{copy.blurb}</p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {planFeatureLines(plan).map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={copy.featured ? "primary" : "secondary"}
                  size="md"
                  className="mt-7 w-full"
                >
                  <Link href="/signup">
                    {copy.cta} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* SECTION 6 - TESTIMONIALS */}
      <Section
        eyebrow="Loved by the cautious"
        title={
          <>
            People who refuse <span className="text-gradient">to be scammed.</span>
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.name}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.06 }}
              className="glass rounded-3xl p-6"
            >
              <div className="mb-3 flex gap-0.5 text-primary">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="text-sm leading-relaxed text-foreground/90">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full font-mono text-xs font-semibold ${t.color}`}
                >
                  {t.initials}
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{t.name}</span> · {t.city}
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </Section>

      {/* SECTION 7 - FAQ */}
      <Section
        id="faq"
        eyebrow="FAQ"
        title={
          <>
            Smart questions, <span className="text-gradient">clear answers.</span>
          </>
        }
      >
        <div className="mx-auto grid max-w-3xl gap-3">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group glass rounded-2xl p-5 open:ring-1 open:ring-primary/30">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                {q}
                <span className="ml-4 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-primary transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <motion.div
          {...fadeUp}
          className="glass-strong relative overflow-hidden rounded-3xl p-10 text-center sm:p-16"
        >
          <div className="absolute -top-32 left-1/2 h-72 w-[70%] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Before you trust it,
            <br />
            <span className="text-gradient">run it through us.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Before you click, reply, or pay anyone online - let Neural Shield check it first.
          </p>
          <Button asChild variant="primary" size="lg" className="mt-8">
            <a href="#demo">
              Scan for Free <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-display font-semibold text-foreground">Neural Shield AI</span>
            <span className="hidden sm:inline">· AI fraud detection for India</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Made with</span>
            <Heart className="h-3.5 w-3.5 fill-danger text-danger" />
            <span>in India</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  sub,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:py-28">
      <motion.div {...fadeUp} className="mx-auto mb-12 max-w-2xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary">
          <Sparkles className="h-3 w-3" /> {eyebrow}
        </div>
        <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
        {sub && <p className="mt-4 text-muted-foreground">{sub}</p>}
      </motion.div>
      {children}
    </section>
  );
}
