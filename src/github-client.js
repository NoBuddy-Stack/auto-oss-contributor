import { Octokit } from "@octokit/rest";
import { getSettings } from "./config/loader.js";

let octokit = null;

export function getOctokit() {
  if (!octokit) {
    const token = process.env.GITHUB_PAT;
    if (!token) {
      throw new Error("GITHUB_PAT environment variable is required");
    }
    octokit = new Octokit({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          console.warn(`Rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s...`);
          return true;
        },
        onSecondaryRateLimit: (retryAfter, options) => {
          console.warn(`Secondary rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s...`);
          return true;
        },
      },
    });
  }
  return octokit;
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function rateLimitedRequest(fn) {
  const settings = getSettings();
  const delay = settings.rateLimit.delayBetweenRequestsMs;
  const result = await fn();
  await sleep(delay);
  return result;
}
