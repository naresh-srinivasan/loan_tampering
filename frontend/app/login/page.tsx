"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          AI
        </span>
        <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Log in to continue</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
      <p className="mt-5 text-center text-sm text-slate-500">
        No account?{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
