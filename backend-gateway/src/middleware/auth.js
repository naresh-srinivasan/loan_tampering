const { verifyToken } = require("../auth");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  // Query-param fallback is only used for direct <img>/<iframe> embeds of the
  // document-file route, where custom headers can't be attached to the request.
  const token = header.startsWith("Bearer ") ? header.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: "Missing authentication token" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient role for this action" });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
