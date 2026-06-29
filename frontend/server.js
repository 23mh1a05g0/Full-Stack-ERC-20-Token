// frontend/server.js
// Lightweight Express server to serve the built React app and expose /health.
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, "dist");

// Health check endpoint – required by the evaluation harness
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve built React assets
app.use(express.static(DIST));

// SPA fallback – send index.html for all unmatched routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`💚 Health endpoint: http://localhost:${PORT}/health`);
});
