import { getOctokit, rateLimitedRequest } from "../github-client.js";
import { getSettings } from "../config/loader.js";

export async function filterOpportunities(issues) {
  const octokit = getOctokit();
  const settings = getSettings();
  const { issueLabels } = settings.discovery;

  console.log(`Filtering ${issues.length} issues through etiquette gates...`);
  const passed = [];
  const rejected = [];

  for (const issue of issues) {
    const checks = await runEtiquetteChecks(octokit, issue, issueLabels);

    if (checks.hasContributing && checks.hasQualifyingLabels) {
      passed.push({ ...issue, etiquette: checks });
    } else {
      rejected.push({
        issue: issue.url,
        reasons: [
          !checks.hasContributing && "No CONTRIBUTING.md found",
          !checks.hasQualifyingLabels && "No qualifying labels",
        ].filter(Boolean),
      });
    }
  }

  console.log(`Etiquette filter: ${passed.length} passed, ${rejected.length} rejected`);
  if (rejected.length > 0) {
    console.log("Rejection reasons:", JSON.stringify(rejected.slice(0, 5), null, 2));
  }

  return passed;
}

async function runEtiquetteChecks(octokit, issue, qualifyingLabels) {
  // Check 1: Repo has CONTRIBUTING.md
  let hasContributing = false;
  try {
    await rateLimitedRequest(() =>
      octokit.repos.getContent({
        owner: issue.repoOwner,
        repo: issue.repoName,
        path: "CONTRIBUTING.md",
      })
    );
    hasContributing = true;
  } catch {
    // CONTRIBUTING.md not found — check alternative locations
    try {
      await rateLimitedRequest(() =>
        octokit.repos.getContent({
          owner: issue.repoOwner,
          repo: issue.repoName,
          path: ".github/CONTRIBUTING.md",
        })
      );
      hasContributing = true;
    } catch {
      hasContributing = false;
    }
  }

  // Check 2: Issue has qualifying labels
  const hasQualifyingLabels = issue.labels.some((label) =>
    qualifyingLabels.some((ql) => label.toLowerCase().includes(ql.toLowerCase()))
  );

  return { hasContributing, hasQualifyingLabels };
}

export function deduplicateByRepo(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.repoFullName}#${issue.number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
