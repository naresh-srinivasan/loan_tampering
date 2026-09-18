const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  PRE_APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] || "bg-slate-100 text-slate-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

const RECOMMENDATION_STYLES: Record<string, string> = {
  AUTO_APPROVE: "bg-green-100 text-green-700",
  MANUAL_REVIEW: "bg-amber-100 text-amber-700",
  REJECT: "bg-red-100 text-red-700",
  REJECT_FRAUD_ALERT: "bg-red-200 text-red-800",
};

export function RecommendationBadge({ recommendation }: { recommendation: string | null }) {
  if (!recommendation) return <span className="text-xs text-slate-400">Not yet analyzed</span>;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RECOMMENDATION_STYLES[recommendation] || "bg-slate-100"}`}>
      {recommendation.replace(/_/g, " ")}
    </span>
  );
}

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
};

export function RiskBadge({ band }: { band: string | null }) {
  if (!band) return null;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RISK_STYLES[band] || "bg-slate-100"}`}>
      {band} risk
    </span>
  );
}
