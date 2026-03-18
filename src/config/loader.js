import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let settings = null;

export function getSettings() {
  if (!settings) {
    const raw = readFileSync(join(__dirname, "settings.json"), "utf-8");
    settings = JSON.parse(raw);
  }
  return settings;
}
