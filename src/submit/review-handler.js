import { getOctokit, rateLimitedRequest } from "../github-client.js";
import { routeLLMRequest } from "../contribute/llm-router.js";
import { loadContributions } from "./track.js";
import { execFileSync } from "child_process";

export async function handlePendingReviews() {
  const octokit = getOctokit();
  const contributions = loadContributions();
  const openPRs = contributions.filter((c) => c.status === "open");

  console.log(`Checking ${openPRs.length} open PRs for review feedback...`);

  for (const contrib of openPRs) {
    try {
      await processReviewComments(octokit, contrib);
    } catch (error) {
      console.warn(`Failed to process reviews for ${contrib.prUrl}: ${error.message}`);
    }
  }
}

async function processReviewComments(octokit, contrib) {
  const { data: reviews } = await rateLimitedRequest(() =>
    octokit.pulls.listReviews({
      owner: contrib.repoOwner,
      repo: contrib.repoName,
      pull_number: contrib.prNumber,
    })
  );

  const changesRequested = reviews.filter(
    (r) => r.state === "CHANGES_REQUESTED" && !contrib.respondedReviews?.includes(r.id)
  );

  if (changesRequested.length === 0) return;

  console.log(`Found ${changesRequested.length} review(s) needing response for ${contrib.prUrl}`);

  // Get review comments
  const { data: comments } = await rateLimitedRequest(() =>
    octokit.pulls.listReviewComments({
      owner: contrib.repoOwner,
      repo: contrib.repoName,
      pull_number: contrib.prNumber,
    })
  );

  if (comments.length === 0) return;

  // Get current PR files
  const { data: files } = await rateLimitedRequest(() =>
    octokit.pulls.listFiles({
      owner: contrib.repoOwner,
      repo: contrib.repoName,
      pull_number: contrib.prNumber,
    })
  );

  const reviewFeedback = comments.map((c) => ({
    file: c.path,
    line: c.line,
    body: c.body,
    diff: c.diff_hunk,
  }));

  // Generate fix for review feedback
  const prompt = `You are responding to code review feedback on a pull request.

PR: ${contrib.prUrl}
Review Comments:
${JSON.stringify(reviewFeedback, null, 2)}

Current files in the PR:
${files.map((f) => `- ${f.filename} (${f.status})`).join("\n")}

Generate the changes needed to address ALL review comments.
Respond with ONLY a JSON array of file changes:
[
  {
    "path": "relative/file/path",
    "action": "modify",
    "content": "full file content after addressing review"
  }
]`;

  try {
    const response = await routeLLMRequest(contrib.type || "bug", prompt);
    const changes = JSON.parse(response.match(/\[[\s\S]*\]/)?.[0] || "[]");

    if (changes.length > 0) {
      console.log(`Generated ${changes.length} file change(s) to address review for ${contrib.prUrl}`);
      // The actual push would happen here — requires cloning the fork and pushing
      // For now, log the intent
      console.log("Review response changes generated (push implementation in fork.js)");
    }
  } catch (error) {
    console.warn(`Failed to generate review response: ${error.message}`);
  }
}
