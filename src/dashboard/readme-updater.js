import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { loadContributions, getMetrics } from "../submit/track.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const README_PATH = join(__dirname, "../../README.md");

export function updateDashboard() {
  const contributions = loadContributions();
  const metrics = getMetrics(contributions);

  const dashboard = generateDashboard(metrics);
  const readme = readFileSync(README_PATH, "utf-8");

  const startMarker = "<!-- DASHBOARD:START -->";
  const endMarker = "<!-- DASHBOARD:END -->";

  let updatedReadme;
  if (readme.includes(startMarker)) {
    const before = readme.split(startMarker)[0];
    const after = readme.split(endMarker)[1] || "";
    updatedReadme = `${before}${startMarker}\n${dashboard}\n${endMarker}${after}`;
  } else {
    updatedReadme = readme + `\n\n${startMarker}\n${dashboard}\n${endMarker}\n`;
  }

  writeFileSync(README_PATH, updatedReadme);
  console.log("Dashboard updated in README.md");
}

function generateDashboard(metrics) {
  let md = `## Contribution Dashboard

*Last updated: ${new Date().toISOString().split("T")[0]}*

### Overview

| Metric | Count |
|--------|-------|
| Total PRs | ${metrics.total} |
| Merged | ${metrics.merged} |
| Open | ${metrics.open} |
| Closed | ${metrics.closed} |
| **Merge Rate** | **${metrics.mergeRate}%** |

### By Language

| Language | PRs |
|----------|-----|
`;

  for (const [lang, count] of Object.entries(metrics.byLanguage).sort((a, b) => b[1] - a[1])) {
    md += `| ${lang} | ${count} |\n`;
  }

  md += `
### By Contribution Type

| Type | PRs |
|------|-----|
`;

  for (const [type, count] of Object.entries(metrics.byType).sort((a, b) => b[1] - a[1])) {
    md += `| ${type} | ${count} |\n`;
  }

  if (metrics.recent.length > 0) {
    md += `
### Recent Activity

| Date | Repo | Type | Status | PR |
|------|------|------|--------|-----|
`;
    for (const c of metrics.recent) {
      const date = c.timestamp?.split("T")[0] || "N/A";
      md += `| ${date} | ${c.repoFullName || "N/A"} | ${c.type || "N/A"} | ${c.status || "N/A"} | [#${c.prNumber || "?"}](${c.prUrl || "#"}) |\n`;
    }
  }

  return md;
}
