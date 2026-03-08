import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiRouter } from "./api/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3001;
const isProd = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/api", apiRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

if (isProd) {
  const clientDir = path.resolve(__dirname, "../../client");
  app.use(express.static(clientDir));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${isProd ? "production" : "development"})`);
});

export default app;
