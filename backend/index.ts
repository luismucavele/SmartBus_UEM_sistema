import { loadEnv } from "./loadEnv";
loadEnv();
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { api } from "./api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001));

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND_ORIGIN || "http://localhost:3000");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

app.use("/api", api);

if (process.env.NODE_ENV === "production") {
  const staticPath = path.resolve(__dirname, "public");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => res.sendFile(path.join(staticPath, "index.html")));
}

server.listen(port, "0.0.0.0", () => {
  console.log(`SmartBus backend running on http://localhost:${port}`);
});
