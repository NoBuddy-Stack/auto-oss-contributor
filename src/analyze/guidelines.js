import { getOctokit, rateLimitedRequest } from "../github-client.js";

export async function parseContributingGuide(owner, repo) {
  const octokit = getOctokit();
  let content = null;

  for (const path of ["CONTRIBUTING.md", ".github/CONTRIBUTING.md"]) {
    try {
      const response = await rateLimitedRequest(() =>
        octokit.repos.getContent({ owner, repo, path })
      );
      content = Buffer.from(response.data.content, "base64").toString("utf-8");
      break;
    } catch {
      continue;
    }
  }

  if (!content) return null;

  return {
    raw: content,
    branchNaming: extractPattern(content, /branch.*nam/i),
    commitFormat: extractPattern(content, /commit.*message|commit.*format|conventional commit/i),
    testRequirements: extractPattern(content, /test|testing/i),
    prTemplate: extractPattern(content, /pull request|PR template/i),
    codeStyle: extractPattern(content, /code style|lint|format/i),
  };
}

function extractPattern(content, pattern) {
  const lines = content.split("\n");
  const matchIndices = [];

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      matchIndices.push(i);
    }
  }

  if (matchIndices.length === 0) return null;

  // Return the section around the first match (up to 10 lines)
  const start = matchIndices[0];
  const end = Math.min(start + 10, lines.length);
  return lines.slice(start, end).join("\n");
}

export async function getPRTemplate(owner, repo) {
  const octokit = getOctokit();

  for (const path of [
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/pull_request_template.md",
    "PULL_REQUEST_TEMPLATE.md",
  ]) {
    try {
      const response = await rateLimitedRequest(() =>
        octokit.repos.getContent({ owner, repo, path })
      );
      return Buffer.from(response.data.content, "base64").toString("utf-8");
    } catch {
      continue;
    }
  }

  return null;
}
