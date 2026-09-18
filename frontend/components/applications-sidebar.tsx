"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Application } from "@/lib/api";
import { StatusBadge, RecommendationBadge } from "@/components/badges";

/**
 * Persistent list of applications alongside the detail view, so an officer
 * (or applicant) can click through applications one after another without
 * bouncing back to a separate list page each time.
 *
 * Re-fetches whenever a decision/upload happens elsewhere on the page (see
 * the "applications:changed" event dispatched from the detail view) so the
 * status shown here doesn't go stale while you're working through the queue.
 */
export function ApplicationsSidebar() {
  const { user } = useAuth();
  const params = useParams<{ id?: string }>();
  const [applications, setApplications] = useState<Application[] | null>(null);

  const refresh = useCallback(() => {
    api.listApplications().then((r) => setApplications(r.applications)).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("applications:changed", refresh);
    return () => window.removeEventListener("applications:changed", refresh);
  }, [refresh]);

  if (!user) return null;
  const isOfficer = user.role === "OFF" || user.role === "ADM";
  const activeId = params?.id ? Number(params.id) : null;

  return (
    <aside className="w-72 shrink-0">
      <div className="sticky top-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {isOfficer ? "Underwriting Queue" : "My Applications"}
          </h2>
          <p className="text-xs text-slate-400">{applications ? `${applications.length} total` : "Loading..."}</p>
        </div>
        <div className="max-h-[calc(100vh-11rem)] overflow-y-auto">
          {applications && applications.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-slate-400">Nothing here yet.</p>
          )}
          {applications?.map((a) => {
            const active = a.id === activeId;
            return (
              <Link
                key={a.id}
                href={`/applications/${a.id}`}
                className={`block border-b border-slate-50 px-4 py-3 text-sm transition-colors ${
                  active ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-medium ${active ? "text-indigo-700" : "text-slate-800"}`}>
                    #{a.id} · ₹{a.loanAmount.toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-400">{a.loanPurpose || "No purpose given"}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={a.status} />
                  {isOfficer && <RecommendationBadge recommendation={a.recommendation} />}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export function notifyApplicationsChanged() {
  window.dispatchEvent(new Event("applications:changed"));
}
