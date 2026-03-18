import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const TEST_COMMANDS = [
  { file: "package.json", cmd: "npm", args: ["test"] },
  { file: "Makefile", cmd: "make", args: ["test"] },
  { file: "pytest.ini", cmd: "pytest", args: [] },
  { file: "setup.py", cmd: "python", args: ["-m", "pytest"] },
  { file: "pyproject.toml", cmd: "python", args: ["-m", "pytest"] },
  { file: "Gemfile", cmd: "bundle", args: ["exec", "rake", "test"] },
  { file: "Cargo.toml", cmd: "cargo", args: ["test"] },
  { file: "go.mod", cmd: "go", args: ["test", "./..."] },
];

export async function validateChanges(repoDir) {
  console.log(`Validating changes in ${repoDir}...`);

  const testResult = await runTests(repoDir);
  const lintResult = await runLint(repoDir);

  return {
    testsRan: testResult.ran,
    testsPassed: testResult.passed,
    testOutput: testResult.output,
    lintRan: lintResult.ran,
    lintPassed: lintResult.passed,
    lintOutput: lintResult.output,
    valid: (!testResult.ran || testResult.passed) && (!lintResult.ran || lintResult.passed),
  };
}

async function runTests(repoDir) {
  for (const { file, cmd, args } of TEST_COMMANDS) {
    if (existsSync(join(repoDir, file))) {
      console.log(`Found ${file}, running: ${cmd} ${args.join(" ")}`);
      try {
        const output = execFileSync(cmd, args, {
          cwd: repoDir,
          encoding: "utf-8",
          timeout: 300000, // 5 min timeout
          stdio: "pipe",
        });
        console.log("Tests passed");
        return { ran: true, passed: true, output };
      } catch (error) {
        console.warn(`Tests failed: ${error.message}`);
        return { ran: true, passed: false, output: error.stderr || error.stdout || error.message };
      }
    }
  }

  console.log("No test runner detected — skipping tests");
  return { ran: false, passed: true, output: "" };
}

async function runLint(repoDir) {
  // Try common linters
  const linters = [
    { file: ".eslintrc.json", cmd: "npx", args: ["eslint", "."] },
    { file: ".eslintrc.js", cmd: "npx", args: ["eslint", "."] },
    { file: ".flake8", cmd: "flake8", args: ["."] },
    { file: ".rubocop.yml", cmd: "rubocop", args: [] },
  ];

  for (const { file, cmd, args } of linters) {
    if (existsSync(join(repoDir, file))) {
      try {
        const output = execFileSync(cmd, args, {
          cwd: repoDir,
          encoding: "utf-8",
          timeout: 120000,
          stdio: "pipe",
        });
        return { ran: true, passed: true, output };
      } catch (error) {
        return { ran: true, passed: false, output: error.stderr || error.message };
      }
    }
  }

  return { ran: false, passed: true, output: "" };
}
