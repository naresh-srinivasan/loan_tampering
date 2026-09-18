"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Application, DocumentRecord, LedgerLineItem, AuditLog, fileUrlWithAuth } from "@/lib/api";
import { StatusBadge, RecommendationBadge, RiskBadge } from "@/components/badges";
import { notifyApplicationsChanged } from "@/components/applications-sidebar";

interface Detail {
  application: Application;
  documents: DocumentRecord[];
  ledgerLineItems: LedgerLineItem[];
  auditLogs: AuditLog[];
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    api
      .getApplication(id)
      .then((d) => {
        setDetail(d);
        setActiveDocId((prev) => prev ?? d.documents[0]?.id ?? null);
        notifyApplicationsChanged();
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    refresh();
  }, [loading, user, router, refresh]);

  if (loading || !user) return null;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!detail) return <p className="text-sm text-slate-500">Loading...</p>;

  const { application, documents, ledgerLineItems, auditLogs } = detail;
  const isOfficer = user.role === "OFF" || user.role === "ADM";

  if (!isOfficer) {
    return <ApplicantView application={application} documents={documents} onUploaded={refresh} />;
  }

  const activeDoc = documents.find((d) => d.id === activeDocId) || documents[0];

  return (
    <div className="space-y-6">
      <PageHeader application={application} />

      <SummaryCards application={application} />

      {application.anomaliesDetected.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <h2 className="mb-2 font-semibold text-red-800">Forensic anomalies detected</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
            {application.anomaliesDetected.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {documents.length > 0 && (
        <>
          <SplitScreenViewer
            applicationId={application.id}
            documents={documents}
            activeDoc={activeDoc}
            onSelect={setActiveDocId}
          />
          <LedgerTable items={ledgerLineItems} />
        </>
      )}

      <DecisionPanel
        applicationId={application.id}
        status={application.status}
        recommendation={application.recommendation}
        onDecided={refresh}
      />

      <AuditTrail logs={auditLogs} />
    </div>
  );
}

function PageHeader({ application, showAnalysisBadges = true }: { application: Application; showAnalysisBadges?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Application #{application.id}</h1>
        <p className="mt-1 text-sm text-slate-500">
          ₹{application.loanAmount.toLocaleString()} over {application.tenureMonths} months
          {application.loanPurpose ? ` · ${application.loanPurpose}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={application.status} />
        {showAnalysisBadges && (
          <>
            <RiskBadge band={application.riskBand} />
            <RecommendationBadge recommendation={application.recommendation} />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applicant view: status + upload only. No score, no tamper flags, no
// heatmap, no ledger breakdown - an applicant has no business (and no need)
// seeing the internals of how the fraud checks work, only the outcome.
// ---------------------------------------------------------------------------

function applicantStepIndex(status: string): number {
  if (status === "PENDING") return 0;
  if (status === "PROCESSING") return 1;
  if (status === "UNDER_REVIEW") return 2;
  return 3; // PRE_APPROVED or REJECTED
}

function ApplicantView({
  application,
  documents,
  onUploaded,
}: {
  application: Application;
  documents: DocumentRecord[];
  onUploaded: () => void;
}) {
  const canUpload = documents.length === 0;
  const currentStep = applicantStepIndex(application.status);

  return (
    <div className="space-y-6">
      <PageHeader application={application} showAnalysisBadges={false} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <ApplicantTimeline currentStep={currentStep} status={application.status} />
      </div>

      {canUpload && <UploadWidget applicationId={application.id} onUploaded={onUploaded} />}

      {!canUpload && application.status !== "PRE_APPROVED" && application.status !== "REJECTED" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Your document has been submitted and is being reviewed. This page will update automatically
          once a decision is made - check back shortly.
        </div>
      )}

      {application.status === "PRE_APPROVED" && (
        <OutcomeCard
          tone="success"
          title="Your application has been approved"
          body="A loan officer has confirmed your documents and financial details meet our requirements. You will be contacted with next steps."
        />
      )}

      {application.status === "REJECTED" && (
        <OutcomeCard
          tone="danger"
          title="Your application was not approved"
          body="Based on the information and documents provided, we're unable to approve this application at this time."
        />
      )}
    </div>
  );
}

function ApplicantTimeline({ currentStep, status }: { currentStep: number; status: string }) {
  const labels = ["Submitted", "Analyzing documents", "Under review", status === "REJECTED" ? "Rejected" : "Decision"];
  return (
    <div className="flex items-center">
      {labels.map((label, i) => {
        const active = i <= currentStep;
        const isLast = i === labels.length - 1;
        const isRejected = isLast && status === "REJECTED";
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  isRejected && active
                    ? "bg-red-600 text-white"
                    : active
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {active ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-medium ${active ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
            </div>
            {!isLast && (
              <div className={`mx-2 mb-5 h-0.5 flex-1 rounded transition-colors ${i < currentStep ? "bg-indigo-600" : "bg-slate-100"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OutcomeCard({ tone, title, body }: { tone: "success" | "danger"; title: string; body: string }) {
  const styles =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-800"
      : "border-red-200 bg-red-50 text-red-800";
  return (
    <div className={`rounded-xl border p-6 shadow-sm ${styles}`}>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm opacity-90">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Officer-only components
// ---------------------------------------------------------------------------

function SummaryCards({ application }: { application: Application }) {
  const cards = [
    { label: "Credit Score", value: application.creditScore ?? "-" },
    { label: "Debt-to-Income", value: application.calculatedDTI != null ? `${(application.calculatedDTI * 100).toFixed(1)}%` : "-" },
    { label: "Avg. Monthly Balance", value: application.averageMonthlyBalance != null ? `₹${application.averageMonthlyBalance.toLocaleString()}` : "-" },
    { label: "Verified Monthly Income", value: application.verifiedMonthlyIncome != null ? `₹${application.verifiedMonthlyIncome.toLocaleString()}` : "-" },
    {
      label: "Math Consistent",
      value:
        application.isMathConsistent === null
          ? application.creditScore != null
            ? "Could not verify - no ledger extracted"
            : "-"
          : application.isMathConsistent
          ? "Yes"
          : "No, drift detected",
    },
    { label: "Tamper Flag", value: application.isTampered === null ? "-" : application.isTampered ? "Flagged" : "Clean" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
          <p className="mt-1.5 text-lg font-semibold text-slate-900">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function UploadWidget({ applicationId, onUploaded }: { applicationId: number; onUploaded: () => void }) {
  const [docType, setDocType] = useState("BANK_STATEMENT");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadDocument(applicationId, docType, file);
      onUploaded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 font-semibold text-slate-900">Upload a supporting document</h2>
      <p className="mb-4 text-sm text-slate-500">We will review your bank statement and get back to you shortly.</p>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Document type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="BANK_STATEMENT">Bank Statement</option>
            <option value="PAYSLIP">Payslip</option>
            <option value="TAX_RETURN">Tax Return</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">File (PDF, JPG, PNG)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!file || busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Analyzing..." : "Upload & Submit"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function SplitScreenViewer({
  applicationId,
  documents,
  activeDoc,
  onSelect,
}: {
  applicationId: number;
  documents: DocumentRecord[];
  activeDoc: DocumentRecord | undefined;
  onSelect: (id: number) => void;
}) {
  if (!activeDoc) return null;
  const fileUrl = fileUrlWithAuth(api.documentFileUrl(applicationId, activeDoc.id));
  const isPdf = activeDoc.mimeType === "application/pdf";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Underwriter Workspace: Original vs. ELA Tamper Heatmap</h2>
        {documents.length > 1 && (
          <select
            value={activeDoc.id}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.docType} - {d.fileName}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-slate-500">Original document</p>
          {isPdf ? (
            <iframe src={fileUrl} className="h-[480px] w-full rounded-lg border border-slate-200" />
          ) : (
            <img src={fileUrl} alt="Original document" className="w-full rounded-lg border border-slate-200" />
          )}
        </div>
        <div>
          <p className="mb-1 text-xs text-slate-500">Error Level Analysis heatmap (brighter = higher recompression error)</p>
          {activeDoc.elaHeatmapBase64 ? (
            <img src={activeDoc.elaHeatmapBase64} alt="ELA heatmap" className="w-full rounded-lg border border-slate-200 bg-black" />
          ) : (
            <p className="text-sm text-slate-400">No heatmap available</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LedgerTable({ items }: { items: LedgerLineItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h2 className="font-semibold text-slate-900">Ledger Reconciliation</h2>
        <p className="text-xs text-slate-500">
          Expected balance = previous balance + credit - debit. Rows in red failed this check.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-2.5 text-left">Date</th>
            <th className="px-5 py-2.5 text-left">Description</th>
            <th className="px-5 py-2.5 text-right">Credit</th>
            <th className="px-5 py-2.5 text-right">Debit</th>
            <th className="px-5 py-2.5 text-right">Balance</th>
            <th className="px-5 py-2.5 text-right">Expected</th>
          </tr>
        </thead>
        <tbody>
          {items.map((li) => (
            <tr key={li.id} className={`border-t border-slate-100 ${li.isMathDrift ? "bg-red-50" : ""}`}>
              <td className="px-5 py-2.5">{li.txnDate}</td>
              <td className="px-5 py-2.5">{li.description}</td>
              <td className="px-5 py-2.5 text-right">{li.credit ? li.credit.toLocaleString() : "-"}</td>
              <td className="px-5 py-2.5 text-right">{li.debit ? li.debit.toLocaleString() : "-"}</td>
              <td className="px-5 py-2.5 text-right font-medium">{li.balance.toLocaleString()}</td>
              <td className={`px-5 py-2.5 text-right ${li.isMathDrift ? "font-semibold text-red-600" : "text-slate-400"}`}>
                {li.expectedBalance.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionPanel({
  applicationId,
  status,
  recommendation,
  onDecided,
}: {
  applicationId: number;
  status: string;
  recommendation: string | null;
  onDecided: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullPanel, setShowFullPanel] = useState(false);

  async function decide(action: string) {
    setBusy(true);
    setError(null);
    try {
      await api.decide(applicationId, action, notes);
      setNotes("");
      onDecided();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status === "PENDING" || status === "PROCESSING") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Waiting for the applicant to upload documents before a review can happen.
      </div>
    );
  }

  if (status === "PRE_APPROVED" || status === "REJECTED") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Decision recorded</h2>
        <p className="mt-1 text-sm text-slate-500">
          This application is {status === "PRE_APPROVED" ? "approved" : "rejected"} - see the audit trail below for
          who decided and when.
        </p>
      </div>
    );
  }

  const fullPanel = (
    <>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for the audit trail (optional)"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        rows={2}
      />
      <div className="flex gap-2">
        <button
          onClick={() => decide("APPROVE")}
          disabled={busy}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => decide("OVERRIDE")}
          disabled={busy}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          Override &amp; Approve
        </button>
        <button
          onClick={() => decide("MANUAL_REJECT")}
          disabled={busy}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  );

  // The system already ran every deterministic check (forensics, ledger math,
  // credit score) and came back clean - a human still confirms it (so every
  // approval has someone accountable for it), but doesn't need to redo the
  // review from scratch. Manual review / ambiguous cases skip straight to the
  // full panel, since those genuinely need a judgment call.
  if (recommendation === "AUTO_APPROVE" && !showFullPanel) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
        <h2 className="font-semibold text-green-800">System check passed</h2>
        <p className="mt-1 text-sm text-green-700">
          Forensics, ledger reconciliation and credit scoring all cleared this application automatically. Confirm to
          finalize the approval.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => decide("APPROVE")}
            disabled={busy}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? "Confirming..." : "Confirm & Approve"}
          </button>
          <button onClick={() => setShowFullPanel(true)} className="text-sm font-medium text-green-800 hover:underline">
            Review manually instead
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-900">Underwriter Decision</h2>
      {fullPanel}
    </div>
  );
}

function AuditTrail({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-900">Audit Trail (WORM log)</h2>
      <ul className="space-y-3 text-sm">
        {logs.map((log) => (
          <li key={log.id} className="border-l-2 border-slate-200 pl-3">
            <p>
              <span className="font-medium text-slate-800">{log.actionTaken.replace(/_/g, " ")}</span>
              {log.reviewerName ? ` by ${log.reviewerName}` : " (system)"}
              <span className="text-slate-400"> · {log.timestamp}</span>
            </p>
            {log.notes && <p className="text-slate-500">{log.notes}</p>}
            <p className="font-mono text-xs text-slate-300">evidence sha256: {log.evidenceHash.slice(0, 24)}...</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
