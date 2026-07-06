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
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://accounts.google.com https://*.googleapis.com; frame-src https://accounts.google.com https://docs.google.com https://*.google.com; media-src 'self' blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com",
  );
  if (isProd) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

/**
 * CORS allowlist. Production locks the API to our own origins so a stolen
 * JWT in someone else's localhost SPA can't make calls. Localhost (any
 * port) stays open for local development.
 */
const ALLOWED_ORIGINS = [
  "https://pocket-stylist-production.up.railway.app",
  ...(process.env.APP_URL ? [process.env.APP_URL] : []),
  ...(process.env.RAILWAY_PUBLIC_DOMAIN
    ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`]
    : []),
];

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin requests + curl / mobile native fetches have no Origin
      // header — those are safe, browsers add Origin for cross-site.
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      callback(new Error("CORS: origin not allowed"));
    },
    credentials: true,
  }),
);
// Stripe webhook needs the raw byte stream for signature verification, so
// skip the JSON parser for that one path. Every other /api/* path keeps its
// pre-existing 50 MB JSON body limit.
app.use((req, res, next) => {
  if (req.path === "/api/billing/webhook") return next();
  return express.json({ limit: "20mb" })(req, res, next);
});

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
