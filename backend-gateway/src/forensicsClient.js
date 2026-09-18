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

async function analyzeDocument(buffer, filename, docType) {
  const form = new FormData();
  form.append("file", buffer, filename);
  form.append("docType", docType);

  const resp = await fetch(`${FORENSICS_URL}/analyze`, { method: "POST", body: form });
  if (!resp.ok) {
    throw new Error(`Forensics service error (${resp.status}): ${await resp.text()}`);
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
