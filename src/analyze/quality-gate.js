import { getSettings } from "../config/loader.js";

export function applyQualityGate(analyses) {
  const settings = getSettings();
  const threshold = settings.analysis.qualityThreshold;

  const passed = [];
  const rejected = [];

  for (const analysis of analyses) {
    if (analysis.confidence >= threshold) {
      passed.push(analysis);
    } else {
      rejected.push({
        issue: analysis.issue.url,
        type: analysis.type,
        confidence: analysis.confidence,
        reason: `Confidence ${analysis.confidence} below threshold ${threshold}`,
      });
    }
  }

  console.log(`Quality gate (threshold: ${threshold}): ${passed.length} passed, ${rejected.length} rejected`);

  if (rejected.length > 0) {
    console.log("Rejected opportunities:");
    for (const r of rejected) {
      console.log(`  - ${r.issue} (${r.type}, confidence: ${r.confidence})`);
    }
  }

  // Sort by confidence descending — prioritize high-confidence contributions
  passed.sort((a, b) => b.confidence - a.confidence);

  return { passed, rejected };
}
