"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/applications" className="flex items-center gap-2.5 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            AI
          </span>
          <span className="hidden sm:inline">Loan Underwriting &amp; Fraud Detection</span>
        </Link>
        {user ? (
          <div className="flex items-center gap-5 text-sm">
            <span className="text-slate-500">
              {user.fullName} <span className="text-slate-400">({roleLabel(user.role)})</span>
            </span>
            {user.role === "APPL" && (
              <Link
                href="/applications/new"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-indigo-700"
              >
                + New Application
              </Link>
            )}
            <button onClick={logout} className="font-medium text-slate-500 transition-colors hover:text-slate-800">
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="font-medium text-slate-600 hover:text-slate-900">
              Log in
            </Link>
            <Link href="/register" className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-indigo-700">
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function roleLabel(role: string) {
  if (role === "APPL") return "Applicant";
  if (role === "OFF") return "Loan Officer";
  return "Admin";
}
