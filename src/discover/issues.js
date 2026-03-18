import { getOctokit, rateLimitedRequest } from "../github-client.js";
import { getSettings } from "../config/loader.js";

export async function discoverLabeledIssues() {
  const octokit = getOctokit();
  const settings = getSettings();
  const { issueLabels, maxIssueAgeDays, maxReposPerScan, languages } = settings.discovery;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxIssueAgeDays);
  const dateStr = cutoffDate.toISOString().split("T")[0];

  const issues = [];

  for (const label of issueLabels) {
    let query = `is:issue is:open label:"${label}" created:>${dateStr} no:assignee`;
    if (languages.length > 0) {
      query += ` language:${languages.join(" language:")}`;
    }

    console.log(`Searching issues with label: ${label}`);

    const response = await rateLimitedRequest(() =>
      octokit.search.issuesAndPullRequests({
        q: query,
        sort: "created",
        order: "desc",
        per_page: 100,
      })
    );

    for (const issue of response.data.items) {
      if (issue.pull_request) continue;

      const [owner, name] = issue.repository_url.split("/").slice(-2);
      issues.push({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body || "",
        labels: issue.labels.map((l) => l.name),
        repoOwner: owner,
        repoName: name,
        repoFullName: `${owner}/${name}`,
        url: issue.html_url,
        createdAt: issue.created_at,
        source: "label_search",
      });
    }
  }

  // Deduplicate by issue ID
  const uniqueIssues = [...new Map(issues.map((i) => [i.id, i])).values()];
  console.log(`Found ${uniqueIssues.length} labeled issues (deduplicated from ${issues.length})`);
  return uniqueIssues;
}
