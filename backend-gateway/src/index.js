require("dotenv").config();
const express = require("express");
const cors = require("cors");

require("./db"); // ensures schema exists on boot

const authRoutes = require("./routes/auth");
const applicationRoutes = require("./routes/applications");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API gateway listening on http://localhost:${PORT}`));
