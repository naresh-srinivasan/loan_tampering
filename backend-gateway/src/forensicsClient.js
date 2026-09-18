const fetch = require("node-fetch");
const FormData = require("form-data");

const FORENSICS_URL = process.env.FORENSICS_URL || "http://localhost:8001";

// Magic-byte sniffing per report: %PDF- for PDFs, 0xFFD8FFE0-family for JPEGs, PNG signature.
const MAGIC_BYTES = [
  { sig: Buffer.from("25504446", "hex"), label: "PDF" }, // %PDF
  { sig: Buffer.from("ffd8ff", "hex"), label: "JPEG" },
  { sig: Buffer.from("89504e47", "hex"), label: "PNG" },
];

function sniffMagicBytes(buffer) {
  for (const { sig, label } of MAGIC_BYTES) {
    if (buffer.subarray(0, sig.length).equals(sig)) return label;
  }
  return null;
}

async function analyzeDocument(buffer, filename, docType, password) {
  const form = new FormData();
  form.append("file", buffer, filename);
  form.append("docType", docType);
  if (password) form.append("password", password);

  const resp = await fetch(`${FORENSICS_URL}/analyze`, { method: "POST", body: form });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const code = body?.detail?.error;
    // password_required / invalid_password are expected, actionable states the
    // caller needs to distinguish from a generic failure - never a bug to log.
    const err = new Error(code || `Forensics service error (${resp.status})`);
    err.code = code;
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

async function scoreApplicant(payload) {
  const resp = await fetch(`${FORENSICS_URL}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`Risk scoring service error (${resp.status}): ${await resp.text()}`);
  }
  return resp.json();
}

module.exports = { sniffMagicBytes, analyzeDocument, scoreApplicant };
