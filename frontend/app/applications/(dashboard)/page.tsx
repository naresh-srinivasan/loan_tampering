"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <div className="space-y-4">
      <Suspense fallback={null}>
        <SubmittedBanner />
      </Suspense>
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">
          {isOfficer
            ? "Select an application from the queue to review it."
            : "Select an application from the list to see its status, or start a new one."}
        </p>
      </div>
    </div>
  );
}

function SubmittedBanner() {
  const searchParams = useSearchParams();
  const [showSubmitted, setShowSubmitted] = useState(false);

  useEffect(() => {
    if (searchParams.get("submitted") === "1") {
      setShowSubmitted(true);
      const timer = setTimeout(() => setShowSubmitted(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!showSubmitted) return null;
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-sm">
      <span className="font-semibold">Application submitted successfully.</span> We will update its status here as
      it is reviewed.
    </div>
  );
}
