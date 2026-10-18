"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/applications");
  }, [loading, user, router]);

  if (loading || user) return null;

  return (
    <div className="space-y-24 pb-16">
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 px-6 py-20 text-center shadow-sm sm:px-12">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />

      <span className="relative inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-indigo-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Academic prototype &middot; AI-driven underwriting
      </span>

      <h1 className="relative mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Automated loan underwriting &amp; document fraud detection
      </h1>

      <p className="relative mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-indigo-100/80 sm:text-lg">
        Applicants upload a bank statement, the system runs deterministic document forensics, ledger reconciliation
        and an ML credit-risk score, and a loan officer confirms the final decision - with every step logged to an
        auditable trail.
      </p>

      <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-900 shadow-sm transition-colors hover:bg-indigo-50"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Log in
        </Link>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: "3", label: "Deterministic fraud checks", detail: "Metadata, font consistency & ledger math" },
    { value: "0.87", label: "Credit model AUC-ROC", detail: "XGBoost on a public lending dataset" },
    { value: "100%", label: "Human-confirmed approvals", detail: "No decision is finalized without an officer" },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-3xl font-semibold tracking-tight text-indigo-600">{s.value}</p>
          <p className="mt-1.5 text-sm font-medium text-slate-800">{s.label}</p>
          <p className="mt-1 text-xs text-slate-400">{s.detail}</p>
        </div>
      ))}
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "Document forensics",
      body: "Inspects PDF metadata and font consistency to catch editing-tool fingerprints that a human reviewer can't see.",
      icon: <IconShield />,
    },
    {
      title: "Ledger reconciliation",
      body: "Extracts the transaction table and checks the running balance with exact arithmetic - a deterministic, zero-guesswork math check.",
      icon: <IconTable />,
    },
    {
      title: "AI credit scoring",
      body: "An XGBoost model scores income, debt-to-income ratio and dependents to produce a calibrated risk recommendation.",
      icon: <IconChart />,
    },
  ];

  return (
    <section id="features" className="scroll-mt-24">
      <SectionHeading eyebrow="Features" title="Three independent checks, one decision" />
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">{f.icon}</span>
            <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Apply & upload", body: "Submit loan details and a supporting document in one step." },
    { title: "Automated analysis", body: "Forensics, ledger reconciliation and credit scoring run in the background." },
    { title: "Officer review", body: "A loan officer sees the evidence - heatmap, metadata flags, ledger table." },
    { title: "Final decision", body: "Approved, rejected, or flagged for fraud - always confirmed by a human." },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-24">
      <SectionHeading eyebrow="Process" title="How it works" />
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
              {i + 1}
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 pt-8 text-center">
      <p className="text-xs text-slate-400">
        Academic prototype for research &amp; demonstration purposes - not a production lending product.
      </p>
    </footer>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l7.5 3.3v5.1c0 4.8-3.1 8.9-7.5 10.1-4.4-1.2-7.5-5.3-7.5-10.1V5.8L12 2.5z" />
      <path d="M9 12l2 2 4-4.2" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V10M12 19V5M20 19v-7" />
      <path d="M3 19h18" />
    </svg>
  );
}
