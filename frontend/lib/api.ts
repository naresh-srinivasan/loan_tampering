const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type Role = "APPL" | "OFF" | "ADM";

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
}

export interface Application {
  id: number;
  applicantId: number;
  loanAmount: number;
  tenureMonths: number;
  loanPurpose: string | null;
  age: number;
  statedMonthlyIncome: number;
  existingMonthlyDebt: number;
  numDependents: number;
  isTampered: boolean | null;
  tamperConfidence: number | null;
  anomaliesDetected: string[];
  isMathConsistent: boolean | null;
  openingBalance: number | null;
  closingBalance: number | null;
  averageMonthlyBalance: number | null;
  verifiedMonthlyIncome: number | null;
  calculatedDTI: number | null;
  creditScore: number | null;
  riskBand: string | null;
  recommendation: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: number;
  docType: string;
  fileName: string;
  mimeType: string;
  elaHeatmapBase64: string | null;
  uploadedAt: string;
}

export interface LedgerLineItem {
  id: number;
  txnDate: string;
  description: string;
  credit: number;
  debit: number;
  balance: number;
  expectedBalance: number;
  isMathDrift: boolean;
}

export interface AuditLog {
  id: number;
  actionTaken: string;
  reviewerName: string | null;
  notes: string | null;
  evidenceHash: string;
  timestamp: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || `Request failed (${resp.status})`) as Error & { code?: string };
    err.code = data.error;
    throw err;
  }
  return data as T;
}

export const api = {
  register: (payload: { fullName: string; email: string; password: string; role: Role }) =>
    request<{ token: string; user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => request<{ user: AuthUser }>("/api/auth/me"),

  listApplications: () => request<{ applications: Application[] }>("/api/applications"),
  createApplication: (payload: Record<string, unknown>) =>
    request<{ application: Application }>("/api/applications", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getApplication: (id: number | string) =>
    request<{
      application: Application;
      documents: DocumentRecord[];
      ledgerLineItems: LedgerLineItem[];
      auditLogs: AuditLog[];
    }>(`/api/applications/${id}`),
  uploadDocument: (id: number | string, docType: string, file: File, password?: string) => {
    const form = new FormData();
    form.append("docType", docType);
    form.append("file", file);
    if (password) form.append("password", password);
    return request<{ application: Application }>(`/api/applications/${id}/documents`, {
      method: "POST",
      body: form,
    });
  },
  decide: (id: number | string, action: string, notes: string) =>
    request<{ application: Application }>(`/api/applications/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    }),
  documentFileUrl: (appId: number | string, docId: number | string) =>
    `${API_URL}/api/applications/${appId}/documents/${docId}/file`,
};

export function fileUrlWithAuth(url: string): string {
  const token = getToken();
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}
