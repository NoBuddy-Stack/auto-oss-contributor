import { getOctokit, rateLimitedRequest, sleep } from "../github-client.js";

export async function ensureFork(owner, repo) {
  const octokit = getOctokit();
  const authenticatedUser = await getAuthenticatedUser();

  // Check if fork already exists
  try {
    await rateLimitedRequest(() =>
      octokit.repos.get({ owner: authenticatedUser, repo })
    );
    console.log(`Fork already exists: ${authenticatedUser}/${repo}`);

    // Sync fork with upstream
    await syncFork(authenticatedUser, repo, owner);
    return { owner: authenticatedUser, repo };
  } catch {
    // Fork doesn't exist — create it
  }

  console.log(`Forking ${owner}/${repo}...`);
  await rateLimitedRequest(() =>
    octokit.repos.createFork({ owner, repo })
  );

  // Wait for fork to be ready
  console.log("Waiting for fork to be ready...");
  await sleep(5000);

  return { owner: authenticatedUser, repo };
}

async function syncFork(forkOwner, repo, upstreamOwner) {
  const octokit = getOctokit();
  try {
    const { data: upstream } = await rateLimitedRequest(() =>
      octokit.repos.get({ owner: upstreamOwner, repo })
    );
    await rateLimitedRequest(() =>
      octokit.repos.mergeUpstream({
        owner: forkOwner,
        repo,
        branch: upstream.default_branch,
      })
    );
    console.log(`Synced fork ${forkOwner}/${repo} with upstream`);
  } catch (error) {
    console.warn(`Failed to sync fork: ${error.message}`);
  }
}

export async function cleanupFork(owner, repo) {
  const octokit = getOctokit();
  const authenticatedUser = await getAuthenticatedUser();

  try {
    await rateLimitedRequest(() =>
      octokit.repos.delete({ owner: authenticatedUser, repo })
    );
    console.log(`Deleted fork: ${authenticatedUser}/${repo}`);
  } catch (error) {
    console.warn(`Failed to delete fork ${repo}: ${error.message}`);
  }
}

let cachedUser = null;

async function getAuthenticatedUser() {
  if (!cachedUser) {
    const octokit = getOctokit();
    const { data } = await octokit.users.getAuthenticated();
    cachedUser = data.login;
  }
  return cachedUser;
}
