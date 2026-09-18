"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Application, DocumentRecord, LedgerLineItem, AuditLog, fileUrlWithAuth } from "@/lib/api";
import { StatusBadge, RecommendationBadge, RiskBadge } from "@/components/badges";

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
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!detail) return <p className="text-slate-500 text-sm">Loading...</p>;

  const { application, documents, ledgerLineItems, auditLogs } = detail;
  const activeDoc = documents.find((d) => d.id === activeDocId) || documents[0];
  const canUpload = user.role === "APPL" && documents.length === 0;
  const isOfficer = user.role === "OFF" || user.role === "ADM";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Application #{application.id}</h1>
          <p className="text-sm text-slate-500">
            ₹{application.loanAmount.toLocaleString()} over {application.tenureMonths} months
            {application.loanPurpose ? ` · ${application.loanPurpose}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={application.status} />
          <RiskBadge band={application.riskBand} />
          <RecommendationBadge recommendation={application.recommendation} />
        </div>
      </div>

      <SummaryCards application={application} />

      {canUpload && <UploadWidget applicationId={application.id} onUploaded={refresh} />}

      {documents.length > 0 && (
        <>
          {application.anomaliesDetected.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h2 className="font-medium text-red-800 mb-2">Forensic anomalies detected</h2>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {application.anomaliesDetected.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <SplitScreenViewer
            applicationId={application.id}
            documents={documents}
            activeDoc={activeDoc}
            onSelect={setActiveDocId}
          />

          <LedgerTable items={ledgerLineItems} />
        </>
      )}

      {isOfficer && <DecisionPanel applicationId={application.id} status={application.status} onDecided={refresh} />}

      <AuditTrail logs={auditLogs} />
    </div>
  );
}

function SummaryCards({ application }: { application: Application }) {
  const cards = [
    { label: "Credit Score", value: application.creditScore ?? "-" },
    { label: "Debt-to-Income", value: application.calculatedDTI != null ? `${(application.calculatedDTI * 100).toFixed(1)}%` : "-" },
    { label: "Avg. Monthly Balance", value: application.averageMonthlyBalance != null ? `₹${application.averageMonthlyBalance.toLocaleString()}` : "-" },
    { label: "Verified Monthly Income", value: application.verifiedMonthlyIncome != null ? `₹${application.verifiedMonthlyIncome.toLocaleString()}` : "-" },
    { label: "Math Consistent", value: application.isMathConsistent === null ? "-" : application.isMathConsistent ? "Yes" : "No, drift detected" },
    { label: "Tamper Flag", value: application.isTampered === null ? "-" : application.isTampered ? "Flagged" : "Clean" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">{c.label}</p>
          <p className="text-lg font-semibold mt-1">{c.value}</p>
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
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h2 className="font-medium mb-4">Upload a supporting document</h2>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Document type</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="border border-slate-300 rounded px-3 py-2 text-sm">
            <option value="BANK_STATEMENT">Bank Statement</option>
            <option value="PAYSLIP">Payslip</option>
            <option value="TAX_RETURN">Tax Return</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">File (PDF, JPG, PNG)</label>
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
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Analyzing (this runs forensics + risk scoring)..." : "Upload & Analyze"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
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
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">Underwriter Workspace: Original vs. ELA Tamper Heatmap</h2>
        {documents.length > 1 && (
          <select
            value={activeDoc.id}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="border border-slate-300 rounded px-2 py-1 text-xs"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.docType} - {d.fileName}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Original document</p>
          {isPdf ? (
            <iframe src={fileUrl} className="w-full h-[480px] border border-slate-200 rounded" />
          ) : (
            <img src={fileUrl} alt="Original document" className="w-full border border-slate-200 rounded" />
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Error Level Analysis heatmap (brighter = higher recompression error)</p>
          {activeDoc.elaHeatmapBase64 ? (
            <img src={activeDoc.elaHeatmapBase64} alt="ELA heatmap" className="w-full border border-slate-200 rounded bg-black" />
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
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="font-medium">Ledger Reconciliation</h2>
        <p className="text-xs text-slate-500">
          Expected balance = previous balance + credit - debit. Rows in red failed this check.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2">Date</th>
            <th className="text-left px-4 py-2">Description</th>
            <th className="text-right px-4 py-2">Credit</th>
            <th className="text-right px-4 py-2">Debit</th>
            <th className="text-right px-4 py-2">Balance</th>
            <th className="text-right px-4 py-2">Expected</th>
          </tr>
        </thead>
        <tbody>
          {items.map((li) => (
            <tr key={li.id} className={`border-t border-slate-100 ${li.isMathDrift ? "bg-red-50" : ""}`}>
              <td className="px-4 py-2">{li.txnDate}</td>
              <td className="px-4 py-2">{li.description}</td>
              <td className="px-4 py-2 text-right">{li.credit ? li.credit.toLocaleString() : "-"}</td>
              <td className="px-4 py-2 text-right">{li.debit ? li.debit.toLocaleString() : "-"}</td>
              <td className="px-4 py-2 text-right font-medium">{li.balance.toLocaleString()}</td>
              <td className={`px-4 py-2 text-right ${li.isMathDrift ? "text-red-600 font-semibold" : "text-slate-400"}`}>
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
  onDecided,
}: {
  applicationId: number;
  status: string;
  onDecided: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-500">
        Waiting for the applicant to upload documents before a review can happen.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="font-medium mb-3">Underwriter Decision</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for the audit trail (optional)"
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm mb-3"
        rows={2}
      />
      <div className="flex gap-2">
        <button
          onClick={() => decide("APPROVE")}
          disabled={busy}
          className="bg-green-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => decide("OVERRIDE")}
          disabled={busy}
          className="bg-amber-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Override &amp; Approve
        </button>
        <button
          onClick={() => decide("MANUAL_REJECT")}
          disabled={busy}
          className="bg-red-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function AuditTrail({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="font-medium mb-3">Audit Trail (WORM log)</h2>
      <ul className="space-y-2 text-sm">
        {logs.map((log) => (
          <li key={log.id} className="border-l-2 border-slate-200 pl-3">
            <p>
              <span className="font-medium">{log.actionTaken.replace(/_/g, " ")}</span>
              {log.reviewerName ? ` by ${log.reviewerName}` : " (system)"}
              <span className="text-slate-400"> · {log.timestamp}</span>
            </p>
            {log.notes && <p className="text-slate-500">{log.notes}</p>}
            <p className="text-slate-300 text-xs font-mono">evidence sha256: {log.evidenceHash.slice(0, 24)}...</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
