import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export function cloneRepo(owner, repo) {
  const tempDir = mkdtempSync(join(tmpdir(), `oss-contrib-${repo}-`));
  const repoUrl = `https://github.com/${owner}/${repo}.git`;

  console.log(`Cloning ${owner}/${repo} to ${tempDir}...`);

  try {
    execFileSync("git", ["clone", "--depth", "1", repoUrl, tempDir], {
      stdio: "pipe",
      timeout: 120000,
    });
    console.log(`Cloned ${owner}/${repo} successfully`);
    return tempDir;
  } catch (error) {
    cleanupClone(tempDir);
    throw new Error(`Failed to clone ${owner}/${repo}: ${error.message}`);
  }
}

export function cleanupClone(dir) {
  if (dir && existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true });
      console.log(`Cleaned up ${dir}`);
    } catch (error) {
      console.warn(`Failed to cleanup ${dir}: ${error.message}`);
    }
  }
}

export function getRepoFiles(dir, extensions) {
  try {
    const result = execFileSync("git", ["-C", dir, "ls-files"], {
      encoding: "utf-8",
      timeout: 30000,
    });
    let files = result.trim().split("\n").filter(Boolean);
    if (extensions && extensions.length > 0) {
      files = files.filter((f) => extensions.some((ext) => f.endsWith(ext)));
    }
    return files;
  } catch {
    return [];
  }
}
