const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const db = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { sniffMagicBytes, analyzeDocument, scoreApplicant } = require("../forensicsClient");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.use(authenticate);

function serializeApplication(app) {
  return {
    ...app,
    isTampered: app.isTampered === null ? null : !!app.isTampered,
    isMathConsistent: app.isMathConsistent === null ? null : !!app.isMathConsistent,
    anomaliesDetected: app.anomaliesDetected ? JSON.parse(app.anomaliesDetected) : [],
  };
}

// --- Create application (Applicant) ---------------------------------------
router.post("/", requireRole("APPL"), (req, res) => {
  const {
    loanAmount, tenureMonths, loanPurpose,
    age, statedMonthlyIncome, existingMonthlyDebt,
    numDependents, numOpenCreditLines, numRealEstateLoans,
  } = req.body || {};

  if (!loanAmount || !tenureMonths || !age || !statedMonthlyIncome) {
    return res.status(400).json({
      error: "loanAmount, tenureMonths, age and statedMonthlyIncome are required",
    });
  }

  const info = db
    .prepare(
      `INSERT INTO applications
        (applicantId, loanAmount, tenureMonths, loanPurpose, age, statedMonthlyIncome,
         existingMonthlyDebt, numDependents, numOpenCreditLines, numRealEstateLoans)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.sub, loanAmount, tenureMonths, loanPurpose || null, age, statedMonthlyIncome,
      existingMonthlyDebt || 0, numDependents || 0, numOpenCreditLines || 5, numRealEstateLoans || 0
    );

  const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ application: serializeApplication(app) });
});

// --- List applications ------------------------------------------------------
router.get("/", (req, res) => {
  const rows =
    req.user.role === "APPL"
      ? db.prepare("SELECT * FROM applications WHERE applicantId = ? ORDER BY id DESC").all(req.user.sub)
      : db.prepare("SELECT * FROM applications ORDER BY id DESC").all();
  res.json({ applications: rows.map(serializeApplication) });
});

function loadApplicationOr404(req, res) {
  const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
  if (!app) {
    res.status(404).json({ error: "Application not found" });
    return null;
  }
  if (req.user.role === "APPL" && app.applicantId !== req.user.sub) {
    res.status(403).json({ error: "Not your application" });
    return null;
  }
  return app;
}

// --- Application detail ------------------------------------------------------
router.get("/:id", (req, res) => {
  const app = loadApplicationOr404(req, res);
  if (!app) return;

  const documents = db
    .prepare("SELECT id, docType, fileName, mimeType, elaHeatmapBase64, uploadedAt FROM documents WHERE applicationId = ?")
    .all(app.id);
  const ledgerLineItems = db
    .prepare("SELECT * FROM ledger_line_items WHERE applicationId = ? ORDER BY id ASC")
    .all(app.id);
  const auditLogs = db
    .prepare(
      `SELECT audit_logs.*, users.fullName AS reviewerName FROM audit_logs
       LEFT JOIN users ON users.id = audit_logs.reviewedBy
       WHERE applicationId = ? ORDER BY id ASC`
    )
    .all(app.id);

  res.json({
    application: serializeApplication(app),
    documents: documents.map((d) => ({ ...d })),
    ledgerLineItems: ledgerLineItems.map((li) => ({ ...li, isMathDrift: !!li.isMathDrift })),
    auditLogs,
  });
});

// --- Upload a document, run forensics + ledger + risk scoring ---------------
router.post("/:id/documents", requireRole("APPL"), upload.single("file"), async (req, res) => {
  const app = loadApplicationOr404(req, res);
  if (!app) return;

  const { docType } = req.body || {};
  if (!req.file) return res.status(400).json({ error: "file is required" });
  if (!["BANK_STATEMENT", "PAYSLIP", "TAX_RETURN"].includes(docType)) {
    return res.status(400).json({ error: "docType must be BANK_STATEMENT, PAYSLIP or TAX_RETURN" });
  }

  const magic = sniffMagicBytes(req.file.buffer);
  if (!magic) {
    return res.status(400).json({ error: "File failed magic-byte validation (expected PDF/JPEG/PNG)" });
  }

  db.prepare("UPDATE applications SET status = 'PROCESSING', updatedAt = datetime('now') WHERE id = ?").run(app.id);

  try {
    const analysis = await analyzeDocument(req.file.buffer, req.file.originalname, docType);
    const { forensicResult, financialAnalysis } = analysis;

    const storageKey = `${app.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, storageKey), req.file.buffer);

    const docInfo = db
      .prepare(
        `INSERT INTO documents (applicationId, docType, fileName, storageKey, mimeType, elaHeatmapBase64)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(app.id, docType, req.file.originalname, storageKey, req.file.mimetype, forensicResult.elaHeatmapBase64 || null);

    if (financialAnalysis) {
      const insertLine = db.prepare(
        `INSERT INTO ledger_line_items
          (applicationId, documentId, txnDate, description, credit, debit, balance, expectedBalance, isMathDrift)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertMany = db.transaction((items) => {
        for (const li of items) {
          insertLine.run(
            app.id, docInfo.lastInsertRowid, li.txnDate, li.description,
            li.credit, li.debit, li.balance, li.expectedBalance, li.isMathDrift ? 1 : 0
          );
        }
      });
      insertMany(financialAnalysis.lineItems || []);
    }

    const isMathConsistent = financialAnalysis ? financialAnalysis.isMathConsistent : true;
    const verifiedMonthlyIncome = financialAnalysis?.totalMonthlyCredits || app.statedMonthlyIncome;

    const scoreResult = await scoreApplicant({
      age: app.age,
      statedMonthlyIncome: app.statedMonthlyIncome,
      existingMonthlyDebt: app.existingMonthlyDebt,
      numDependents: app.numDependents,
      numOpenCreditLines: app.numOpenCreditLines,
      numRealEstateLoans: app.numRealEstateLoans,
      verifiedMonthlyIncome,
      isTampered: !!forensicResult.isTampered,
      isMathConsistent,
    });

    const newStatus =
      scoreResult.recommendation === "AUTO_APPROVE" ? "PRE_APPROVED" :
      scoreResult.recommendation === "REJECT" || scoreResult.recommendation === "REJECT_FRAUD_ALERT" ? "REJECTED" :
      "UNDER_REVIEW";

    db.prepare(
      `UPDATE applications SET
        isTampered = ?, tamperConfidence = ?, anomaliesDetected = ?,
        isMathConsistent = ?, openingBalance = ?, closingBalance = ?, averageMonthlyBalance = ?,
        verifiedMonthlyIncome = ?, calculatedDTI = ?, creditScore = ?, riskBand = ?,
        recommendation = ?, status = ?, updatedAt = datetime('now')
       WHERE id = ?`
    ).run(
      forensicResult.isTampered ? 1 : 0,
      forensicResult.tamperConfidence,
      JSON.stringify(forensicResult.anomaliesDetected || []),
      isMathConsistent ? 1 : 0,
      financialAnalysis?.openingBalance ?? null,
      financialAnalysis?.closingBalance ?? null,
      financialAnalysis?.averageMonthlyBalance ?? null,
      scoreResult.verifiedMonthlyIncome,
      scoreResult.calculatedDTI,
      scoreResult.creditScore,
      scoreResult.riskBand,
      scoreResult.recommendation,
      newStatus,
      app.id
    );

    const evidenceHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ forensicResult, financialAnalysis, scoreResult }))
      .digest("hex");
    db.prepare(
      `INSERT INTO audit_logs (applicationId, reviewedBy, actionTaken, evidenceHash, notes)
       VALUES (?, ?, ?, ?, ?)`
    ).run(app.id, null, "AUTOMATED_ANALYSIS", evidenceHash, `System recommendation: ${scoreResult.recommendation}`);

    const updated = db.prepare("SELECT * FROM applications WHERE id = ?").get(app.id);
    res.status(201).json({ application: serializeApplication(updated), forensicResult, financialAnalysis, scoreResult });
  } catch (err) {
    db.prepare("UPDATE applications SET status = 'PENDING', updatedAt = datetime('now') WHERE id = ?").run(app.id);
    console.error(err);
    res.status(502).json({ error: "Forensics/risk pipeline failed", detail: err.message });
  }
});

// --- Serve the original uploaded document (for the split-screen viewer) ----
router.get("/:id/documents/:docId/file", (req, res) => {
  const app = loadApplicationOr404(req, res);
  if (!app) return;

  const doc = db
    .prepare("SELECT * FROM documents WHERE id = ? AND applicationId = ?")
    .get(req.params.docId, app.id);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const filePath = path.join(UPLOAD_DIR, doc.storageKey);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

  res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${doc.fileName}"`);
  fs.createReadStream(filePath).pipe(res);
});

// --- Officer decision override ----------------------------------------------
router.post("/:id/decision", requireRole("OFF", "ADM"), (req, res) => {
  const app = db.prepare("SELECT * FROM applications WHERE id = ?").get(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });

  const { action, notes } = req.body || {};
  if (!["APPROVE", "OVERRIDE", "MANUAL_REJECT"].includes(action)) {
    return res.status(400).json({ error: "action must be APPROVE, OVERRIDE or MANUAL_REJECT" });
  }

  const newStatus = action === "MANUAL_REJECT" ? "REJECTED" : "PRE_APPROVED";
  db.prepare("UPDATE applications SET status = ?, updatedAt = datetime('now') WHERE id = ?").run(newStatus, app.id);

  const evidenceHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ applicationId: app.id, action, notes, at: Date.now() }))
    .digest("hex");
  db.prepare(
    `INSERT INTO audit_logs (applicationId, reviewedBy, actionTaken, evidenceHash, notes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(app.id, req.user.sub, action, evidenceHash, notes || null);

  const updated = db.prepare("SELECT * FROM applications WHERE id = ?").get(app.id);
  res.json({ application: serializeApplication(updated) });
});

module.exports = router;
