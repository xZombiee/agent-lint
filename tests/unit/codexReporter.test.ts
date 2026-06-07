import assert from "node:assert/strict";
import test from "node:test";
import { formatCodexReport } from "../../src/reporters/codexReporter.ts";
import type { AgentLintReport } from "../../src/types.ts";

test("formatCodexReport groups actionable issues by file and compresses info notes", () => {
  const report: AgentLintReport = {
    projectRoot: "/repo",
    scannedFiles: ["AGENTS.md", "ui/AGENTS.md", "extensions/acpx/AGENTS.md"],
    summary: {
      issueCount: 13,
      errorCount: 5,
      warningCount: 0,
      infoCount: 8,
    },
    issues: [
      {
        id: "1",
        rule: "missingPackageScripts",
        severity: "error",
        sourceFile: "extensions/acpx/AGENTS.md",
        line: 41,
        message: "Missing package script",
        evidence: {
          instructionText: "Run pnpm test:extension.",
          repoFact: 'extensions/acpx/package.json has no "test:extension" script.',
        },
      },
      {
        id: "2",
        rule: "missingPackageScripts",
        severity: "error",
        sourceFile: "extensions/acpx/AGENTS.md",
        line: 42,
        message: "Missing package script",
        evidence: {
          instructionText: "Run pnpm build.",
          repoFact: 'extensions/acpx/package.json has no "build" script.',
        },
      },
      {
        id: "3",
        rule: "missingPackageScripts",
        severity: "error",
        sourceFile: "ui/AGENTS.md",
        line: 13,
        message: "Missing package script",
        evidence: {
          instructionText: "Run pnpm ui:i18n:sync.",
          repoFact: 'ui/package.json has no "ui:i18n:sync" script.',
        },
      },
      {
        id: "4",
        rule: "missingPackageScripts",
        severity: "error",
        sourceFile: "ui/AGENTS.md",
        line: 14,
        message: "Missing package script",
        evidence: {
          instructionText: "Run pnpm ui:i18n:check.",
          repoFact: 'ui/package.json has no "ui:i18n:check" script.',
        },
      },
      {
        id: "5",
        rule: "missingPackageScripts",
        severity: "error",
        sourceFile: "ui/AGENTS.md",
        line: 14,
        message: "Missing package script",
        evidence: {
          instructionText: "Run pnpm ui:i18n:report.",
          repoFact: 'ui/package.json has no "ui:i18n:report" script.',
        },
      },
      {
        id: "6",
        rule: "brokenFileReferences",
        severity: "info",
        sourceFile: "AGENTS.md",
        line: 27,
        message: "External repository reference",
        referenceKind: "external",
        evidence: {
          instructionText: "See the other repo.",
          repoFact:
            "The instruction points to another repository or external workspace, which cannot be validated against this repository.",
        },
      },
      {
        id: "7",
        rule: "brokenFileReferences",
        severity: "info",
        sourceFile: "AGENTS.md",
        line: 50,
        message: "External repository reference",
        referenceKind: "external",
        evidence: {
          instructionText: "See the other repo again.",
          repoFact:
            "The instruction points to another repository or external workspace, which cannot be validated against this repository.",
        },
      },
      {
        id: "8",
        rule: "brokenFileReferences",
        severity: "info",
        sourceFile: "AGENTS.md",
        line: 52,
        message: "External repository reference",
        referenceKind: "external",
        evidence: {
          instructionText: "See another workspace.",
          repoFact:
            "The instruction points to another repository or external workspace, which cannot be validated against this repository.",
        },
      },
      {
        id: "9",
        rule: "brokenFileReferences",
        severity: "info",
        sourceFile: "docs/AGENTS.md",
        line: 29,
        message: "External repository reference",
        referenceKind: "external",
        evidence: {
          instructionText: "See docs repo.",
          repoFact:
            "The instruction points to another repository or external workspace, which cannot be validated against this repository.",
        },
      },
      {
        id: "10",
        rule: "brokenFileReferences",
        severity: "info",
        sourceFile: "docs/AGENTS.md",
        line: 32,
        message: "External repository reference",
        referenceKind: "external",
        evidence: {
          instructionText: "See docs repo again.",
          repoFact:
            "The instruction points to another repository or external workspace, which cannot be validated against this repository.",
        },
      },
      {
        id: "11",
        rule: "brokenFileReferences",
        severity: "info",
        sourceFile: "docs/AGENTS.md",
        line: 35,
        message: "External repository reference",
        referenceKind: "external",
        evidence: {
          instructionText: "See docs mirror.",
          repoFact:
            "The instruction points to another repository or external workspace, which cannot be validated against this repository.",
        },
      },
      {
        id: "12",
        rule: "brokenFileReferences",
        severity: "info",
        sourceFile: "extensions/acpx/AGENTS.md",
        line: 7,
        message: "External repository reference",
        referenceKind: "external",
        evidence: {
          instructionText: "See sibling repo.",
          repoFact:
            "The instruction points to another repository or external workspace, which cannot be validated against this repository.",
        },
      },
      {
        id: "13",
        rule: "brokenFileReferences",
        severity: "info",
        sourceFile: "extensions/acpx/AGENTS.md",
        line: 19,
        message: "External repository reference",
        referenceKind: "external",
        evidence: {
          instructionText: "See sibling workspace.",
          repoFact:
            "The instruction points to another repository or external workspace, which cannot be validated against this repository.",
        },
      },
    ],
  };

  const output = formatCodexReport(report);

  assert.match(output, /^# Agent Lint$/mu);
  assert.match(output, /Actionable issues: 5/u);
  assert.match(
    output,
    /- `extensions\/acpx\/AGENTS\.md`\n  missing package scripts in `extensions\/acpx\/package\.json` at lines 41-42: `test:extension` and `build`/u,
  );
  assert.match(
    output,
    /- `ui\/AGENTS\.md`\n  missing package scripts in `ui\/package\.json` at lines 13-14: `ui:i18n:sync`, `ui:i18n:check`, and `ui:i18n:report`/u,
  );
  assert.match(
    output,
    /external repository references could not be validated locally: `AGENTS\.md` \(lines 27, 50, 52\); `docs\/AGENTS\.md` \(lines 29, 32, 35\); `extensions\/acpx\/AGENTS\.md` \(lines 7, 19\)/u,
  );
  assert.doesNotMatch(output, /Recommended behavior for the agent/u);
  assert.doesNotMatch(output, /## Task/u);
});

test("formatCodexReport renders a short success message when no issues exist", () => {
  const report: AgentLintReport = {
    projectRoot: "/repo",
    scannedFiles: ["AGENTS.md"],
    summary: {
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    },
    issues: [],
  };

  const output = formatCodexReport(report);

  assert.equal(
    output,
    "# Agent Lint\n\nNo issues found. The scanned instructions match repository facts.",
  );
});

test("formatCodexReport limits long per-file actionable sections", () => {
  const report: AgentLintReport = {
    projectRoot: "/repo",
    scannedFiles: ["AGENTS.md"],
    summary: {
      issueCount: 4,
      errorCount: 4,
      warningCount: 0,
      infoCount: 0,
    },
    issues: [
      {
        id: "1",
        rule: "packageManagerMismatch",
        severity: "error",
        sourceFile: "AGENTS.md",
        line: 10,
        message: "Package manager mismatch",
        evidence: {
          instructionText: "Use npm install.",
          repoFact: "package.json packageManager declares pnpm, but the instruction uses npm.",
        },
      },
      {
        id: "2",
        rule: "runtimeMismatch",
        severity: "error",
        sourceFile: "AGENTS.md",
        line: 11,
        message: "Runtime version mismatch",
        evidence: {
          instructionText: "Use Node 18.",
          repoFact: "Repository runtime metadata says package.json >=20, but the instruction mentions node 18.",
        },
      },
      {
        id: "3",
        rule: "ciReferenceMismatch",
        severity: "error",
        sourceFile: "AGENTS.md",
        line: 12,
        message: "Missing GitHub Actions workflow",
        evidence: {
          instructionText: "Use workflow test.",
          repoFact: 'No GitHub Actions workflow named "test" was found. Known workflows: build.',
        },
      },
      {
        id: "4",
        rule: "toolMismatch",
        severity: "error",
        sourceFile: "AGENTS.md",
        line: 13,
        message: "Tool mismatch",
        evidence: {
          instructionText: "Use Jest.",
          repoFact: "Jest was not detected, but Vitest was detected via vitest.config.ts.",
        },
      },
    ],
  };

  const output = formatCodexReport(report);

  assert.match(output, /- `AGENTS\.md`/u);
  assert.match(output, /package manager mismatch at line 10/u);
  assert.match(output, /runtime version mismatch at line 11/u);
  assert.match(output, /missing GitHub Actions workflow at line 12/u);
  assert.match(output, /\n  \+1 more issue group/u);
  assert.doesNotMatch(output, /tool mismatch at line 13/u);
});
