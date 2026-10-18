"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogoMark } from "@/components/logo-mark";

export function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={user ? "/applications" : "/"} className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-semibold tracking-tight text-slate-900">Loan Underwriting</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">AI Fraud Detection</span>
          </span>
        </Link>

        {onHome && !user && (
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="transition-colors hover:text-slate-900">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-slate-900">
              How it works
            </a>
          </nav>
        )}

        {user ? (
          <div className="flex items-center gap-4">
            {user.role === "APPL" && (
              <Link
                href="/applications/new"
                className="hidden items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 sm:inline-flex"
              >
                <span className="text-base leading-none">+</span> New Application
              </Link>
            )}
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {initials(user.fullName)}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-medium text-slate-800">{user.fullName}</p>
                <p className="text-xs text-slate-400">{roleLabel(user.role)}</p>
              </div>
              <button
                onClick={logout}
                className="ml-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-slate-600 transition-colors hover:text-slate-900">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Get started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function roleLabel(role: string) {
  if (role === "APPL") return "Applicant";
  if (role === "OFF") return "Loan Officer";
  return "Admin";
}
