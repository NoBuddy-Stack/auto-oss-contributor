import { getOctokit, rateLimitedRequest } from "../github-client.js";
import { getSettings } from "../config/loader.js";

export async function discoverTrendingRepos() {
  const octokit = getOctokit();
  const settings = getSettings();
  const { maxReposPerScan, languages } = settings.discovery;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

  let query = `pushed:>${dateStr} stars:>100 has:issues`;
  if (languages.length > 0) {
    query += ` language:${languages.join(" language:")}`;
  }

  console.log(`Searching trending repos with query: ${query}`);

  const repos = [];
  let page = 1;
  const perPage = Math.min(maxReposPerScan, 100);

  while (repos.length < maxReposPerScan) {
    const response = await rateLimitedRequest(() =>
      octokit.search.repos({
        q: query,
        sort: "stars",
        order: "desc",
        per_page: perPage,
        page,
      })
    );

    if (response.data.items.length === 0) break;

    for (const repo of response.data.items) {
      repos.push({
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        stars: repo.stargazers_count,
        language: repo.language,
        description: repo.description,
        hasIssues: repo.has_issues,
        url: repo.html_url,
        source: "trending",
      });
    }

    page++;
    if (repos.length >= maxReposPerScan) break;
  }

  console.log(`Found ${repos.length} trending repos`);
  return repos.slice(0, maxReposPerScan);
}
