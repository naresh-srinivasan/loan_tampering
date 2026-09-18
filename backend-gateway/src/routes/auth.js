const express = require("express");
const db = require("../db");
const { hashPassword, verifyPassword, signToken } = require("../auth");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/register", (req, res) => {
  const { fullName, email, password, role, phoneNumber } = req.body || {};

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "fullName, email and password are required" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const allowedRoles = ["APPL", "OFF"]; // ADM not self-registrable in this prototype
  const finalRole = allowedRoles.includes(role) ? role : "APPL";

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });

  const info = db
    .prepare(
      `INSERT INTO users (fullName, email, passwordHash, phoneNumber, role) VALUES (?, ?, ?, ?, ?)`
    )
    .run(fullName, email, hashPassword(password), phoneNumber || null, finalRole);

  const user = db.prepare("SELECT id, fullName, email, role FROM users WHERE id = ?").get(info.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ token, user });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!user.isActive) return res.status(403).json({ error: "Account is disabled" });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
  });
});

router.get("/me", authenticate, (req, res) => {
  const user = db
    .prepare("SELECT id, fullName, email, role, phoneNumber FROM users WHERE id = ?")
    .get(req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

module.exports = router;
