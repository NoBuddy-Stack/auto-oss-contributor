import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getOctokit, rateLimitedRequest } from "../github-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "../../data");
const CONTRIBUTIONS_FILE = join(DATA_DIR, "contributions.json");

export function loadContributions() {
  if (!existsSync(CONTRIBUTIONS_FILE)) return [];
  return JSON.parse(readFileSync(CONTRIBUTIONS_FILE, "utf-8"));
}

export function saveContribution(contribution) {
  const contributions = loadContributions();
  contributions.push({
    ...contribution,
    timestamp: new Date().toISOString(),
  });
  writeFileSync(CONTRIBUTIONS_FILE, JSON.stringify(contributions, null, 2));
  console.log(`Saved contribution record for ${contribution.prUrl}`);
}

export async function updateContributionStatuses() {
  const octokit = getOctokit();
  const contributions = loadContributions();
  let updated = 0;

  for (const contrib of contributions) {
    if (contrib.status === "merged" || contrib.status === "closed") continue;

    try {
      const { data: pr } = await rateLimitedRequest(() =>
        octokit.pulls.get({
          owner: contrib.repoOwner,
          repo: contrib.repoName,
          pull_number: contrib.prNumber,
        })
      );

      const newStatus = pr.merged ? "merged" : pr.state;
      if (newStatus !== contrib.status) {
        contrib.status = newStatus;
        contrib.updatedAt = new Date().toISOString();
        updated++;
      }
    } catch (error) {
      console.warn(`Failed to check PR status for ${contrib.prUrl}: ${error.message}`);
    }
  }

  if (updated > 0) {
    writeFileSync(CONTRIBUTIONS_FILE, JSON.stringify(contributions, null, 2));
    console.log(`Updated ${updated} contribution statuses`);
  }

  return contributions;
}

export function getMetrics(contributions) {
  const total = contributions.length;
  const merged = contributions.filter((c) => c.status === "merged").length;
  const open = contributions.filter((c) => c.status === "open").length;
  const closed = contributions.filter((c) => c.status === "closed" && !c.merged).length;

  const byLanguage = {};
  const byType = {};

  for (const c of contributions) {
    byLanguage[c.language || "unknown"] = (byLanguage[c.language || "unknown"] || 0) + 1;
    byType[c.type || "unknown"] = (byType[c.type || "unknown"] || 0) + 1;
  }

  return {
    total,
    merged,
    open,
    closed,
    mergeRate: total > 0 ? ((merged / total) * 100).toFixed(1) : "0",
    byLanguage,
    byType,
    recent: contributions.slice(-10).reverse(),
  };
}
