import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { Express } from "express";
import type { Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { analyzeCvRouter } from "./routes/analyzeCv.js";
import { precheckCvRouter } from "./routes/precheckCv.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ServerStartOptions = {
  frontendPath?: string;
  host?: string;
  port?: number;
};

type StartedServer = {
  app: Express;
  port: number;
  server: Server;
  url: string;
};

export function createApp(options: Pick<ServerStartOptions, "frontendPath"> = {}) {
  const app = express();
  const frontendPath = options.frontendPath || process.env.FRONTEND_PATH || path.resolve(__dirname, "../../frontend");

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(frontendPath));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/precheck-cv", precheckCvRouter);
  app.use("/api/analyze-cv", analyzeCvRouter);

  return app;
}

export function startServer(options: ServerStartOptions = {}) {
  const app = createApp({ frontendPath: options.frontendPath });
  const port = Number(options.port ?? process.env.PORT ?? 3001);
  const host = options.host ?? process.env.HOST;

  return new Promise<StartedServer>((resolve) => {
    const onListening = () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      const displayHost = host || "localhost";
      const url = `http://${displayHost}:${actualPort}`;

      console.log(`Career Signal Engine running at ${url}`);
      resolve({ app, port: actualPort, server, url });
    };
    const server = host ? app.listen(port, host, onListening) : app.listen(port, onListening);
  });
}

const isCliEntry = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isCliEntry) {
  await startServer();
}
