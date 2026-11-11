import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseValue(raw: string) {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

export function loadEnv() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, ".env"),
    path.resolve(__dirname, "..", ".env"),
    path.resolve(process.cwd(), ".env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      if (!key || process.env[key] != null) continue;
      process.env[key] = parseValue(trimmed.slice(idx + 1));
    }
    break;
  }
}
