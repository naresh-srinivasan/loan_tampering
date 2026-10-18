"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Submission is now two fast, sequential calls (create application, upload
// document) - the gateway acknowledges the upload immediately and runs
// forensics/scoring in the background, so this page redirects to the new
// application's own page right away instead of waiting for analysis to
// finish. That page polls and shows the live status (including a
// password-retry prompt if the document turns out to be encrypted) once
// results start coming in.
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
  const [docType, setDocType] = useState("BANK_STATEMENT");
  const [file, setFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please attach a supporting document.");
      return;
    }
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
      try {
        await api.uploadDocument(application.id, docType, file, pdfPassword || undefined);
      } catch {
        // The application record already exists - send them to its page
        // rather than losing it, even if this particular upload attempt
        // failed fast validation (e.g. bad file type).
      }
      router.push(`/applications/${application.id}?submitted=1`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">New Loan Application</h1>
      <p className="mb-6 text-sm text-slate-500">
        Fill in your loan details and attach a supporting document - we will review both together.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <fieldset disabled={submitting} className="space-y-4 disabled:opacity-60">
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
          </fieldset>

          <div className="border-t border-slate-100 pt-4">
            <Field label="Document type">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={submitting}
                className={inputClass}
              >
                <option value="BANK_STATEMENT">Bank Statement</option>
                <option value="PAYSLIP">Payslip</option>
                <option value="TAX_RETURN">Tax Return</option>
              </select>
            </Field>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-600">Supporting document (PDF, JPG, PNG)</label>
              <input
                type="file"
                required
                disabled={submitting}
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-600">
                Document password <span className="font-normal text-slate-400">(only if it&apos;s encrypted)</span>
              </label>
              <input
                type="password"
                disabled={submitting}
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="Leave blank if not password protected"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                If you skip this and the document turns out to be encrypted, we&apos;ll ask for the password on the
                next page instead of losing your application.
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Application"}
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
