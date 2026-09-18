"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/applications" className="font-semibold text-slate-800">
          AI Loan Underwriting &amp; Fraud Detection
        </Link>
        {user ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              {user.fullName} <span className="text-slate-400">({roleLabel(user.role)})</span>
            </span>
            {user.role === "APPL" && (
              <Link href="/applications/new" className="text-blue-600 hover:underline">
                New Application
              </Link>
            )}
            <button onClick={logout} className="text-slate-500 hover:text-slate-800">
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-blue-600 hover:underline">
              Log in
            </Link>
            <Link href="/register" className="text-blue-600 hover:underline">
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
