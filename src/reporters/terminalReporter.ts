import {
  blue,
  green,
  red,
  resolveColorUsage,
  yellow,
} from "../utils/terminalColors.ts";
import type { AgentLintIssue, AgentLintReport, RuleName } from "../types.ts";

const RULE_TITLES: Record<RuleName, string> = {
  brokenFileReferences: "Broken file reference",
  missingPackageScripts: "Missing package script",
  toolMismatch: "Tool mismatch",
  explicitContradictions: "Explicit contradiction",
};

function formatCount(label: string, value: number): string {
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

function formatLocation(issue: AgentLintIssue): string {
  return issue.line ? `${issue.sourceFile}:${issue.line}` : issue.sourceFile;
}

function colorSeverity(value: string, severity: AgentLintIssue["severity"], useColor: boolean): string {
  if (severity === "error") {
    return red(value, { useColor });
  }

  if (severity === "warning") {
    return yellow(value, { useColor });
  }

  return blue(value, { useColor });
}

function colorSummaryCount(label: string, count: number, useColor: boolean): string {
  const value = formatCount(label, count);

  if (label === "error") {
    return red(value, { useColor });
  }

  if (label === "warning") {
    return yellow(value, { useColor });
  }

  return blue(value, { useColor });
}

export function formatTerminalReport(
  report: AgentLintReport,
  options?: { useColor?: boolean },
): string {
  const useColor = resolveColorUsage(options);
  const lines: string[] = [
    "Agent Lint",
    "",
    `Scanned ${formatCount("instruction file", report.scannedFiles.length)}.`,
    `Found ${formatCount("issue", report.summary.issueCount)}: ${colorSummaryCount("error", report.summary.errorCount, useColor)}, ${colorSummaryCount("warning", report.summary.warningCount, useColor)}, ${colorSummaryCount("info", report.summary.infoCount, useColor)}.`,
  ];

  if (report.issues.length === 0) {
    lines.push("", green("No issues found.", { useColor }));
    return lines.join("\n");
  }

  for (const issue of report.issues) {
    const severityLabel = colorSeverity(issue.severity.toUpperCase(), issue.severity, useColor);
    const kindLabel = issue.referenceKind ? ` [${issue.referenceKind}]` : "";
    lines.push(
      "",
      `${severityLabel} ${formatLocation(issue)} ${RULE_TITLES[issue.rule]}${kindLabel}`,
      `Instruction says: ${issue.evidence.instructionText}`,
      `Repo fact: ${issue.evidence.repoFact}`,
    );

    if (issue.suggestion) {
      lines.push(`Suggestion: ${issue.suggestion}`);
    }
  }

  lines.push(
    "",
    "Next step:",
    "Run agent-lint --codex to generate an agent-ready remediation summary.",
  );

  return lines.join("\n");
}
