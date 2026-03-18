import { routeLLMRequest } from "../contribute/llm-router.js";

const CONTRIBUTION_TYPES = {
  typo: { keywords: ["typo", "spelling", "misspell", "grammatical", "grammar"], complexity: "low" },
  docs: { keywords: ["documentation", "readme", "docs", "comment", "jsdoc", "docstring"], complexity: "low" },
  dependency: { keywords: ["dependency", "upgrade", "update", "bump", "outdated", "deprecated"], complexity: "low" },
  bug: { keywords: ["bug", "fix", "error", "crash", "broken", "issue", "not working"], complexity: "medium" },
  test: { keywords: ["test", "coverage", "spec", "unit test", "integration test"], complexity: "medium" },
  feature: { keywords: ["feature", "enhancement", "add", "implement", "support"], complexity: "high" },
};

export async function analyzeFeasibility(issue) {
  const type = classifyContributionType(issue);
  const confidence = await scoreConfidence(issue, type);

  return {
    issue,
    type,
    complexity: CONTRIBUTION_TYPES[type]?.complexity || "high",
    confidence,
    feasible: confidence > 0,
  };
}

function classifyContributionType(issue) {
  const text = `${issue.title} ${issue.body}`.toLowerCase();
  let bestType = "feature";
  let bestScore = 0;

  for (const [type, config] of Object.entries(CONTRIBUTION_TYPES)) {
    const score = config.keywords.filter((kw) => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Also check labels
  for (const label of issue.labels) {
    const labelLower = label.toLowerCase();
    for (const [type, config] of Object.entries(CONTRIBUTION_TYPES)) {
      if (config.keywords.some((kw) => labelLower.includes(kw))) {
        return type;
      }
    }
  }

  return bestType;
}

async function scoreConfidence(issue, type) {
  const prompt = `You are evaluating whether an automated system can successfully contribute to this open source issue.

Issue Title: ${issue.title}
Issue Body: ${issue.body?.slice(0, 2000) || "No description"}
Labels: ${issue.labels.join(", ")}
Contribution Type: ${type}
Repository: ${issue.repoFullName}

Evaluate the feasibility of auto-generating a fix. Consider:
1. Is the issue clearly described?
2. Is the scope small enough to tackle automatically?
3. Does it require deep domain knowledge?
4. Is it likely a straightforward change?

Respond with ONLY a JSON object:
{
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation>",
  "suggestedApproach": "<one-line approach>"
}`;

  try {
    const response = await routeLLMRequest(type, prompt);
    const parsed = JSON.parse(response);
    return parsed.confidence;
  } catch (error) {
    console.warn(`Failed to score confidence for ${issue.url}: ${error.message}`);
    // Fallback: simple heuristic based on type
    const fallbackScores = { typo: 0.9, docs: 0.7, dependency: 0.6, bug: 0.4, test: 0.5, feature: 0.3 };
    return fallbackScores[type] || 0.3;
  }
}
