import "dotenv/config";
import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiRouter } from "./api/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3001;
const isProd = process.env.NODE_ENV === "production";

app.disable("x-powered-by");

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// JSON-only error handler — converts body-parser HTML errors (e.g. malformed JSON)
// into structured `{error: "invalid_json"}` so API clients aren't surprised by HTML.
const jsonErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  type ParseErr = Error & { type?: string };
  const parseErr = err as ParseErr | undefined;
  if (
    parseErr &&
    (parseErr.type === "entity.parse.failed" ||
      parseErr.type === "entity.too.large" ||
      parseErr.type === "request.aborted")
  ) {
    const code =
      parseErr.type === "entity.too.large"
        ? "payload_too_large"
        : parseErr.type === "request.aborted"
          ? "request_aborted"
          : "invalid_json";
    res.status(parseErr.type === "entity.too.large" ? 413 : 400).json({ error: code });
    return;
  }
  next(err);
};
app.use(jsonErrorHandler);

app.use("/api", apiRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

if (isProd) {
  const clientDir = path.resolve(__dirname, "../../client");

  // Prevent browser from caching sw.js and registerSW.js — always fetch fresh
  app.get(["/sw.js", "/registerSW.js"], (_req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  app.use(express.static(clientDir));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${isProd ? "production" : "development"})`);
});

export default app;
