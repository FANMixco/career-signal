import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeCvRouter } from "./routes/analyzeCv.js";
import { precheckCvRouter } from "./routes/precheckCv.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../../frontend");

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(frontendPath));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/precheck-cv", precheckCvRouter);
app.use("/api/analyze-cv", analyzeCvRouter);

app.listen(port, () => {
  console.log(`Career Signal Engine running at http://localhost:${port}`);
});
