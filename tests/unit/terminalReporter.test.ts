import assert from "node:assert/strict";
import test from "node:test";
import { formatTerminalReport } from "../../src/reporters/terminalReporter.ts";
import type { AgentLintReport } from "../../src/types.ts";

const baseReport: AgentLintReport = {
  projectRoot: "/repo",
  scannedFiles: ["AGENTS.md"],
  summary: {
    issueCount: 3,
    errorCount: 1,
    warningCount: 1,
    infoCount: 1,
  },
  issues: [
    {
      id: "1",
      rule: "brokenFileReferences",
      severity: "error",
      sourceFile: "AGENTS.md",
      line: 1,
      message: "Broken file reference",
      evidence: {
        instructionText: "Use src/missing.ts.",
        repoFact: "Missing file.",
      },
    },
    {
      id: "2",
      rule: "missingPackageScripts",
      severity: "warning",
      sourceFile: "AGENTS.md",
      line: 2,
      message: "Missing package script",
      evidence: {
        instructionText: "Run npm test.",
        repoFact: "Missing test script.",
      },
    },
    {
      id: "3",
      rule: "brokenFileReferences",
      severity: "info",
      sourceFile: "AGENTS.md",
      line: 3,
      message: "Path policy",
      referenceKind: "policy",
      evidence: {
        instructionText: "Store reports in a git-ignored path.",
        repoFact: "No safe path detected.",
      },
    },
  ],
};

test("formatTerminalReport can render without ANSI colors", () => {
  const output = formatTerminalReport(baseReport, { useColor: false });

  assert.doesNotMatch(output, /\u001b\[/u);
  assert.match(output, /Found 3 issues: 1 error, 1 warning, 1 info\./u);
  assert.match(output, /ERROR AGENTS\.md:1/u);
  assert.match(output, /INFO AGENTS\.md:3 Broken file reference \[policy\]/u);
});

test("formatTerminalReport pluralizes zero and multiple summary counts", () => {
  const output = formatTerminalReport(
    {
      ...baseReport,
      summary: {
        issueCount: 2,
        errorCount: 0,
        warningCount: 2,
        infoCount: 0,
      },
      issues: baseReport.issues.slice(0, 2),
    },
    { useColor: false },
  );

  assert.match(output, /Found 2 issues: 0 errors, 2 warnings, 0 infos\./u);
});

test("formatTerminalReport can render with ANSI colors", () => {
  const output = formatTerminalReport(baseReport, { useColor: true });

  assert.match(output, /\u001b\[31mERROR\u001b\[0m/u);
  assert.match(output, /\u001b\[33mWARNING\u001b\[0m/u);
  assert.match(output, /\u001b\[34mINFO\u001b\[0m/u);
});
