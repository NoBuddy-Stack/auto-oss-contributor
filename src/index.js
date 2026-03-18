import { getSettings } from "./config/loader.js";
import { discoverTrendingRepos } from "./discover/trending.js";
import { discoverLabeledIssues } from "./discover/issues.js";
import { filterOpportunities, deduplicateByRepo } from "./discover/filter.js";
import { parseContributingGuide } from "./analyze/guidelines.js";
import { analyzeFeasibility } from "./analyze/feasibility.js";
import { applyQualityGate } from "./analyze/quality-gate.js";
import { cloneRepo, cleanupClone } from "./contribute/clone.js";
import { generateFix } from "./contribute/generate.js";
import { validateChanges } from "./contribute/validate.js";
import { ensureFork } from "./submit/fork.js";
import { submitPR } from "./submit/pr.js";
import { saveContribution, updateContributionStatuses } from "./submit/track.js";
import { handlePendingReviews } from "./submit/review-handler.js";
import { updateDashboard } from "./dashboard/readme-updater.js";
import { sendDailySummary } from "./notify/summary.js";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const settings = getSettings();
  const stage = process.argv.find((a) => a.startsWith("--stage="))?.split("=")[1];

  console.log("=== Auto OSS Contributor ===");
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Settings: maxRepos=${settings.discovery.maxReposPerScan}, threshold=${settings.analysis.qualityThreshold}, maxPRs=${settings.submission.maxPRsPerDay}`);

  try {
    if (!stage || stage === "discover") {
      await runDiscovery();
    }
    if (!stage || stage === "all") {
      await runFullPipeline();
    }
    if (stage === "reviews") {
      await handlePendingReviews();
    }
    if (stage === "dashboard") {
      await updateContributionStatuses();
      updateDashboard();
    }
    if (stage === "notify") {
      await sendDailySummary();
    }
  } catch (error) {
    console.error(`Pipeline failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

async function runDiscovery() {
  console.log("\n--- Stage 1: Discovery ---");
  const [trendingRepos, labeledIssues] = await Promise.all([
    discoverTrendingRepos(),
    discoverLabeledIssues(),
  ]);

  console.log(`Found ${trendingRepos.length} trending repos, ${labeledIssues.length} labeled issues`);
  return { trendingRepos, labeledIssues };
}

async function runFullPipeline() {
  const settings = getSettings();
  let prsSubmitted = 0;

  // Stage 1: Discovery
  console.log("\n--- Stage 1: Discovery ---");
  const issues = await discoverLabeledIssues();

  // Stage 2: Filter
  console.log("\n--- Stage 2: Etiquette Filter ---");
  const deduplicated = deduplicateByRepo(issues);
  const filtered = await filterOpportunities(deduplicated);

  // Stage 3: Analysis
  console.log("\n--- Stage 3: Analysis ---");
  const analyses = [];
  for (const issue of filtered) {
    try {
      const analysis = await analyzeFeasibility(issue);
      analyses.push(analysis);
    } catch (error) {
      console.warn(`Failed to analyze ${issue.url}: ${error.message}`);
    }
  }

  // Stage 4: Quality Gate
  console.log("\n--- Stage 4: Quality Gate ---");
  const { passed } = applyQualityGate(analyses);

  // Stage 5: Generate & Submit
  console.log("\n--- Stage 5: Generate & Submit ---");
  for (const analysis of passed) {
    if (prsSubmitted >= settings.submission.maxPRsPerDay) {
      console.log(`Daily PR limit reached (${settings.submission.maxPRsPerDay}). Stopping.`);
      break;
    }

    let repoDir = null;
    try {
      // Parse contributing guide
      const guide = await parseContributingGuide(analysis.issue.repoOwner, analysis.issue.repoName);

      // Clone repo
      repoDir = cloneRepo(analysis.issue.repoOwner, analysis.issue.repoName);

      // Generate fix
      const changes = await generateFix(analysis, repoDir, guide);

      // Validate
      const validation = await validateChanges(repoDir);
      if (!validation.valid) {
        console.warn(`Validation failed for ${analysis.issue.url}: tests=${validation.testsPassed}, lint=${validation.lintPassed}`);
        continue;
      }

      // Fork & submit PR
      const fork = await ensureFork(analysis.issue.repoOwner, analysis.issue.repoName);
      const pr = await submitPR(analysis, changes, repoDir, fork, guide);

      // Track contribution
      saveContribution({
        repoOwner: analysis.issue.repoOwner,
        repoName: analysis.issue.repoName,
        repoFullName: analysis.issue.repoFullName,
        issueNumber: analysis.issue.number,
        issueUrl: analysis.issue.url,
        prNumber: pr.number,
        prUrl: pr.url,
        type: analysis.type,
        confidence: analysis.confidence,
        language: analysis.issue.language,
        status: "open",
      });

      prsSubmitted++;
      console.log(`[${prsSubmitted}/${settings.submission.maxPRsPerDay}] PR submitted: ${pr.url}`);
    } catch (error) {
      console.error(`Failed to contribute to ${analysis.issue.url}: ${error.message}`);
    } finally {
      if (repoDir) cleanupClone(repoDir);
    }
  }

  // Stage 6: Update dashboard
  console.log("\n--- Stage 6: Dashboard Update ---");
  try {
    await updateContributionStatuses();
    updateDashboard();
  } catch (error) {
    console.warn(`Dashboard update failed: ${error.message}`);
  }

  // Stage 7: Handle pending reviews
  console.log("\n--- Stage 7: Review Responses ---");
  try {
    await handlePendingReviews();
  } catch (error) {
    console.warn(`Review handling failed: ${error.message}`);
  }

  // Stage 8: Send daily summary notification
  console.log("\n--- Stage 8: Daily Summary Notification ---");
  try {
    await sendDailySummary();
  } catch (error) {
    console.warn(`Daily summary notification failed: ${error.message}`);
  }

  console.log(`\n=== Pipeline complete. ${prsSubmitted} PRs submitted. ===`);
}

main();
