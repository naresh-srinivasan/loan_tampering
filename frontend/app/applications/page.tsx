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
  const isOfficer = user.role === "OFF" || user.role === "ADM";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isOfficer ? "Underwriting Queue" : "My Applications"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isOfficer ? "Review and decide on submitted loan applications." : "Track the status of your loan applications."}
          </p>
        </div>
        {!isOfficer && (
          <Link
            href="/applications/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            + New Application
          </Link>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {applications && applications.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            {isOfficer ? "No applications have been submitted yet." : "You haven't created any applications yet."}
          </p>
          {!isOfficer && (
            <Link href="/applications/new" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
              Create your first application
            </Link>
          )}
        </div>
      )}

      {applications && applications.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">ID</th>
                <th className="px-5 py-3 text-left">Loan Amount</th>
                <th className="px-5 py-3 text-left">Purpose</th>
                <th className="px-5 py-3 text-left">Status</th>
                {isOfficer && <th className="px-5 py-3 text-left">Risk</th>}
                {isOfficer && <th className="px-5 py-3 text-left">Recommendation</th>}
                <th className="px-5 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50"
                  onClick={() => router.push(`/applications/${a.id}`)}
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">#{a.id}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-900">₹{a.loanAmount.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-slate-600">{a.loanPurpose || "-"}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={a.status} />
                  </td>
                  {isOfficer && (
                    <td className="px-5 py-3.5">
                      <RiskBadge band={a.riskBand} />
                    </td>
                  )}
                  {isOfficer && (
                    <td className="px-5 py-3.5">
                      <RecommendationBadge recommendation={a.recommendation} />
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-xs text-slate-400">{a.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
