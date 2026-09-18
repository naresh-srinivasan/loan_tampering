"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function NewApplicationPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    loanAmount: "",
    tenureMonths: "",
    loanPurpose: "",
    age: "",
    statedMonthlyIncome: "",
    existingMonthlyDebt: "",
    numDependents: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { application } = await api.createApplication({
        loanAmount: Number(form.loanAmount),
        tenureMonths: Number(form.tenureMonths),
        loanPurpose: form.loanPurpose,
        age: Number(form.age),
        statedMonthlyIncome: Number(form.statedMonthlyIncome),
        existingMonthlyDebt: Number(form.existingMonthlyDebt || 0),
        numDependents: Number(form.numDependents || 0),
      });
      router.push(`/applications/${application.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">New Loan Application</h1>
      <p className="mb-6 text-sm text-slate-500">Tell us a bit about the loan you are applying for.</p>
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Loan amount requested (₹)">
            <input type="number" required min={1} value={form.loanAmount} onChange={set("loanAmount")} className={inputClass} />
          </Field>
          <Field label="Tenure (months)">
            <input type="number" required min={1} value={form.tenureMonths} onChange={set("tenureMonths")} className={inputClass} />
          </Field>
          <Field label="Loan purpose">
            <input value={form.loanPurpose} onChange={set("loanPurpose")} className={inputClass} placeholder="e.g. Home renovation" />
          </Field>
          <Field label="Your age">
            <input type="number" required min={18} max={100} value={form.age} onChange={set("age")} className={inputClass} />
          </Field>
          <Field label="Stated monthly income (₹)">
            <input type="number" required min={0} value={form.statedMonthlyIncome} onChange={set("statedMonthlyIncome")} className={inputClass} />
          </Field>
          <Field label="Existing monthly debt obligations (₹)">
            <input type="number" min={0} value={form.existingMonthlyDebt} onChange={set("existingMonthlyDebt")} className={inputClass} />
          </Field>
          <Field label="Number of dependents">
            <input type="number" min={0} value={form.numDependents} onChange={set("numDependents")} className={inputClass} />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Application"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
