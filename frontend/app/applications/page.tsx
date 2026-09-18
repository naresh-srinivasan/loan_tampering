"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Application } from "@/lib/api";
import { StatusBadge, RecommendationBadge, RiskBadge } from "@/components/badges";

export default function ApplicationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    api
      .listApplications()
      .then((r) => setApplications(r.applications))
      .catch((e) => setError(e.message));
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">
          {user.role === "APPL" ? "My Applications" : "Underwriting Queue"}
        </h1>
        {user.role === "APPL" && (
          <Link href="/applications/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium">
            + New Application
          </Link>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {applications && applications.length === 0 && (
        <p className="text-slate-500 text-sm">No applications yet.</p>
      )}

      {applications && applications.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">Loan Amount</th>
                <th className="text-left px-4 py-2">Purpose</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Risk</th>
                <th className="text-left px-4 py-2">Recommendation</th>
                <th className="text-left px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => router.push(`/applications/${a.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs">#{a.id}</td>
                  <td className="px-4 py-3">₹{a.loanAmount.toLocaleString()}</td>
                  <td className="px-4 py-3">{a.loanPurpose || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge band={a.riskBand} />
                  </td>
                  <td className="px-4 py-3">
                    <RecommendationBadge recommendation={a.recommendation} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{a.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
