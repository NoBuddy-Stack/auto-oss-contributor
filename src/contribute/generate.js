import { readFileSync } from "fs";
import { join } from "path";
import { routeLLMRequest } from "./llm-router.js";
import { getRepoFiles } from "./clone.js";

export async function generateFix(analysis, repoDir, contributingGuide) {
  const { issue, type } = analysis;

  console.log(`Generating fix for ${issue.repoFullName}#${issue.number} (${type})...`);

  const relevantFiles = findRelevantFiles(repoDir, issue, type);
  const fileContents = readRelevantFiles(repoDir, relevantFiles);
  const prompt = buildPrompt(issue, type, fileContents, contributingGuide);

  const response = await routeLLMRequest(type, prompt);
  const changes = parseChanges(response);

  if (!changes || changes.length === 0) {
    throw new Error("LLM did not produce any file changes");
  }

  return changes;
}

function findRelevantFiles(repoDir, issue, type) {
  const allFiles = getRepoFiles(repoDir);

  if (type === "typo" || type === "docs") {
    return allFiles.filter(
      (f) =>
        f.endsWith(".md") ||
        f.endsWith(".txt") ||
        f.endsWith(".rst") ||
        f === "README" ||
        f.includes("doc")
    ).slice(0, 10);
  }

  // For code changes, try to find files mentioned in the issue
  const issueText = `${issue.title} ${issue.body}`.toLowerCase();
  const mentioned = allFiles.filter((f) => {
    const filename = f.split("/").pop().toLowerCase();
    return issueText.includes(filename);
  });

  if (mentioned.length > 0) return mentioned.slice(0, 10);

  // Fallback: return source files by common extensions
  const sourceExts = [".js", ".ts", ".py", ".rb", ".go", ".java", ".rs", ".cpp", ".c"];
  return allFiles
    .filter((f) => sourceExts.some((ext) => f.endsWith(ext)))
    .slice(0, 10);
}

function readRelevantFiles(repoDir, files) {
  const contents = {};
  for (const file of files) {
    try {
      const content = readFileSync(join(repoDir, file), "utf-8");
      // Limit file size to avoid token overflow
      contents[file] = content.length > 5000 ? content.slice(0, 5000) + "\n...(truncated)" : content;
    } catch {
      // Skip unreadable files
    }
  }
  return contents;
}

function buildPrompt(issue, type, fileContents, contributingGuide) {
  let prompt = `You are an expert open source contributor. Generate a fix for this issue.

## Issue
Title: ${issue.title}
Body: ${issue.body?.slice(0, 3000) || "No description"}
Labels: ${issue.labels.join(", ")}
Repository: ${issue.repoFullName}
Contribution Type: ${type}

## Relevant Files
`;

  for (const [path, content] of Object.entries(fileContents)) {
    prompt += `\n### ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
  }

  if (contributingGuide) {
    prompt += `\n## Contributing Guidelines (summary)\n${contributingGuide.raw?.slice(0, 1000) || "None"}\n`;
  }

  prompt += `
## Instructions
Generate the minimal fix for this issue. Respond with ONLY a JSON array of file changes:
[
  {
    "path": "relative/file/path",
    "action": "modify" | "create",
    "content": "full file content after changes"
  }
]

Rules:
- Make the MINIMUM change needed
- Follow the project's existing code style
- Do NOT add unrelated changes
- Include ONLY the files that need to change
`;

  return prompt;
}

function parseChanges(response) {
  // Extract JSON from the response (may be wrapped in markdown code blocks)
  let jsonStr = response;

  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON array directly
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const changes = JSON.parse(jsonStr);
    if (!Array.isArray(changes)) return null;
    return changes.filter(
      (c) => c.path && c.content && ["modify", "create"].includes(c.action)
    );
  } catch {
    console.warn("Failed to parse LLM response as JSON changes");
    return null;
  }
}
