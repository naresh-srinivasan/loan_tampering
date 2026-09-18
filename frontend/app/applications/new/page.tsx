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
  const [docType, setDocType] = useState("BANK_STATEMENT");
  const [file, setFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState<"required" | "invalid" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Once the application record exists, retrying with a password re-uses it
  // rather than creating a duplicate application on every attempt.
  const [createdApplicationId, setCreatedApplicationId] = useState<number | null>(null);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function tryUpload(applicationId: number) {
    try {
      await api.uploadDocument(applicationId, docType, file as File, pdfPassword || undefined);
      router.push("/applications?submitted=1");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "password_required" || code === "invalid_password") {
        setNeedsPassword(code === "invalid_password" ? "invalid" : "required");
        return;
      }
      // Some other failure (service down, bad file, etc.) - the application
      // record already exists, so send them to its page rather than losing it.
      router.push(`/applications/${applicationId}`);
    }
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
      if (createdApplicationId) {
        // Retrying after a password prompt - the application already exists.
        await tryUpload(createdApplicationId);
      } else {
        const { application } = await api.createApplication({
          loanAmount: Number(form.loanAmount),
          tenureMonths: Number(form.tenureMonths),
          loanPurpose: form.loanPurpose,
          age: Number(form.age),
          statedMonthlyIncome: Number(form.statedMonthlyIncome),
          existingMonthlyDebt: Number(form.existingMonthlyDebt || 0),
          numDependents: Number(form.numDependents || 0),
        });
        setCreatedApplicationId(application.id);
        await tryUpload(application.id);
      }
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
      <p className="mb-6 text-sm text-slate-500">
        Fill in your loan details and attach a supporting document - we will review both together.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <fieldset disabled={!!createdApplicationId} className="space-y-4 disabled:opacity-60">
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
                disabled={!!createdApplicationId}
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
                disabled={!!createdApplicationId}
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>

            {needsPassword && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">
                  {needsPassword === "invalid"
                    ? "That password didn't work - try again."
                    : "This document is password protected."}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Many bank statements are encrypted (e.g. with your account number or date of birth). Enter the
                  password to unlock it - it is used once for this upload and is not stored.
                </p>
                <input
                  type="password"
                  autoFocus
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  placeholder="Document password"
                  className="mt-2 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : needsPassword ? "Unlock & Submit" : "Submit Application"}
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
