"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ApplicationsDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) return null;
  const isOfficer = user.role === "OFF" || user.role === "ADM";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-sm text-slate-500">
        {isOfficer
          ? "Select an application from the queue to review it."
          : "Select an application from the list to see its status, or start a new one."}
      </p>
    </div>
  );
}
