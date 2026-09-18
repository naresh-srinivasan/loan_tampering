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

  return (
    <div className="max-w-lg mx-auto bg-white p-8 rounded-lg border border-slate-200">
      <h1 className="text-xl font-semibold mb-6">New Loan Application</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Loan amount requested (₹)">
          <input type="number" required min={1} value={form.loanAmount} onChange={set("loanAmount")} className="input" />
        </Field>
        <Field label="Tenure (months)">
          <input type="number" required min={1} value={form.tenureMonths} onChange={set("tenureMonths")} className="input" />
        </Field>
        <Field label="Loan purpose">
          <input value={form.loanPurpose} onChange={set("loanPurpose")} className="input" placeholder="e.g. Home renovation" />
        </Field>
        <Field label="Your age">
          <input type="number" required min={18} max={100} value={form.age} onChange={set("age")} className="input" />
        </Field>
        <Field label="Stated monthly income (₹)">
          <input type="number" required min={0} value={form.statedMonthlyIncome} onChange={set("statedMonthlyIncome")} className="input" />
        </Field>
        <Field label="Existing monthly debt obligations (₹)">
          <input type="number" min={0} value={form.existingMonthlyDebt} onChange={set("existingMonthlyDebt")} className="input" />
        </Field>
        <Field label="Number of dependents">
          <input type="number" min={0} value={form.numDependents} onChange={set("numDependents")} className="input" />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white rounded py-2 font-medium disabled:opacity-50">
          {submitting ? "Creating..." : "Create Application"}
        </button>
      </form>
      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgb(203 213 225);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
