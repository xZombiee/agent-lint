import assert from "node:assert/strict";
import path from "node:path";
import {
  appendFile,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { runAgentLint } from "../../src/index.ts";
import { pathExists } from "../../src/utils/pathExists.ts";

const FIXTURES_ROOT = path.resolve("tests/fixtures");

async function copyFixture(name: string): Promise<string> {
  const targetRoot = await mkdtemp(path.join(tmpdir(), `agent-lint-${name}-`));
  const sourcePath = path.join(FIXTURES_ROOT, name);
  const targetPath = path.join(targetRoot, name);
  await cp(sourcePath, targetPath, { recursive: true });
  return targetPath;
}

test("runAgentLint returns zero issues for a valid fixture", async () => {
  const projectRoot = await copyFixture("valid-repo");
  const result = await runAgentLint({ projectRoot });

  assert.equal(result.report.summary.issueCount, 0);
  assert.equal(result.exitCode, 0);
});

test("runAgentLint reports stale instructions and CI failure for the stale fixture", async () => {
  const projectRoot = await copyFixture("stale-repo");
  const result = await runAgentLint({ projectRoot, ci: true });

  assert.equal(result.report.summary.errorCount, 1);
  assert.equal(result.report.summary.warningCount, 5);
  assert.equal(result.report.summary.issueCount, 6);
  assert.equal(result.exitCode, 1);
});

test("runAgentLint reports repository-fact mismatches", async () => {
  const projectRoot = await copyFixture("fact-mismatch-repo");
  const result = await runAgentLint({ projectRoot });

  assert.equal(result.report.summary.errorCount, 0);
  assert.equal(result.report.summary.warningCount, 6);

  const rules = result.report.issues.map((issue) => issue.rule);
  assert(rules.includes("toolMismatch"));
  assert(rules.includes("explicitContradictions"));
  assert(rules.includes("packageManagerMismatch"));
  assert(rules.includes("runtimeMismatch"));
  assert.equal(rules.filter((rule) => rule === "ciReferenceMismatch").length, 2);
});

test("git-ignored example paths in instructions do not produce broken-path noise", async () => {
  const projectRoot = await copyFixture("valid-repo");
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  const gitignorePath = path.join(projectRoot, ".gitignore");
  await Promise.all([
    appendFile(
      agentsPath,
      "\nStore temporary analysis artifacts only in a git-ignored path such as `.codex/`, `tmp/`, or another explicitly ignored reports directory.\n",
    ),
    writeFile(gitignorePath, "reports/\n", "utf8"),
  ]);

  const result = await runAgentLint({ projectRoot });

  assert.equal(result.report.summary.issueCount, 0);
});

test("nested AGENTS files are discovered and can resolve local relative paths", async () => {
  const projectRoot = await copyFixture("valid-repo");
  const nestedDirectory = path.join(projectRoot, "security", "checkout");
  await mkdir(path.join(nestedDirectory, "docs"), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(nestedDirectory, "AGENTS.md"),
      "Keep checkout notes in ./docs/runbook.md.\n",
      "utf8",
    ),
    writeFile(path.join(nestedDirectory, "docs", "runbook.md"), "# Runbook\n", "utf8"),
  ]);

  const result = await runAgentLint({ projectRoot });

  assert(result.report.scannedFiles.includes("security/checkout/AGENTS.md"));
  assert.equal(result.report.summary.issueCount, 0);
});

test("OpenClaw-style prose slash phrases do not become broken local path errors", async () => {
  const projectRoot = await copyFixture("openclaw-like");
  const result = await runAgentLint({ projectRoot });

  assert.equal(result.report.summary.errorCount, 0);
  assert.equal(result.report.summary.warningCount, 0);
  assert.equal(result.report.summary.infoCount, 3);

  const messages = result.report.issues.map((issue) => issue.evidence.instructionText);
  assert(messages.some((message) => message.includes("openclaw/docs")));
  assert(messages.some((message) => message.includes("extensions/telegram/src/index.ts:80")));
  assert(messages.every((message) => !message.includes("Docs/user-visible")));
  assert(messages.every((message) => !message.includes("Fix/triage")));
  assert(messages.every((message) => !message.includes("docs/config")));
  assert(messages.every((message) => !message.includes("compat/deprecation")));
  assert(messages.every((message) => !message.includes("Public/hostile/observed")));
  assert(messages.every((message) => !message.includes("app/path")));
  assert(messages.every((message) => !message.includes("Docker/package/E2E/live/cross-OS")));
  assert(messages.every((message) => !message.includes("vYYYY.M.D-beta.N")));
  assert(messages.every((message) => !message.includes("gpt-5.5")));
  assert(messages.every((message) => !message.includes("docs/<locale>/**")));
  assert(messages.every((message) => !message.includes("[Config](/gateway/configuration)")));
  assert(messages.every((message) => !message.includes("agents.defaults.skills")));
  assert(messages.every((message) => !message.includes("openclaw/plugin-sdk/*")));
  assert(messages.every((message) => !message.includes("**Discord/WhatsApp:**")));
  assert(messages.every((message) => !message.includes("pnpm format:*")));
  assert(messages.every((message) => !message.includes("pnpm test*")));
  assert(messages.every((message) => !message.includes("core/plugin")));
  assert(messages.every((message) => !message.includes("release/")));
  assert(messages.every((message) => !message.includes("../openclaw-docs")));
});

test("unreadable directories do not crash the scan", async () => {
  const projectRoot = await copyFixture("valid-repo");
  const blockedDirectory = path.join(projectRoot, "blocked");

  await mkdir(blockedDirectory, { recursive: true });
  await writeFile(path.join(blockedDirectory, "secret.txt"), "secret\n", "utf8");
  await chmod(blockedDirectory, 0o000);

  try {
    const result = await runAgentLint({ projectRoot });
    assert.equal(result.report.summary.issueCount, 0);
  } finally {
    await chmod(blockedDirectory, 0o755);
  }
});

test("json and codex outputs contain the documented structures", async () => {
  const projectRoot = await copyFixture("stale-repo");
  const result = await runAgentLint({ projectRoot });
  const jsonReport = JSON.parse(result.outputs.json) as {
    summary: { issueCount: number };
    issues: Array<{ rule: string }>;
  };

  assert.equal(jsonReport.summary.issueCount, 6);
  assert(jsonReport.issues.some((issue) => issue.rule === "brokenFileReferences"));
  assert.match(
    result.outputs.codex,
    /Prefer repository facts over stale instruction text/u,
  );
  assert.match(result.outputs.codex, /## Task/u);
});

test("writeSummary creates report and summary artifacts", async () => {
  const projectRoot = await copyFixture("stale-repo");
  const result = await runAgentLint({ projectRoot, writeSummary: true });

  assert(result.artifactPaths);
  assert(await pathExists(result.artifactPaths!.reportPath));
  assert(await pathExists(result.artifactPaths!.summaryPath));

  const reportJson = JSON.parse(await readFile(result.artifactPaths!.reportPath, "utf8")) as {
    summary: { issueCount: number };
  };
  const summaryMarkdown = await readFile(result.artifactPaths!.summaryPath, "utf8");

  assert.equal(reportJson.summary.issueCount, 6);
  assert.match(summaryMarkdown, /# Agent Lint Summary/u);
});
