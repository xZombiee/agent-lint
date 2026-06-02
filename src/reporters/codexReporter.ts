import type { AgentDoctorIssue, AgentDoctorReport, IssueSeverity } from "../types.ts";

function formatLocation(issue: AgentDoctorIssue): string {
  return issue.line ? `${issue.sourceFile}:${issue.line}` : issue.sourceFile;
}

function formatIssue(issue: AgentDoctorIssue): string {
  const parts = [
    `- \`${formatLocation(issue)}\` ${issue.message}: ${issue.evidence.repoFact}`,
  ];

  if (issue.suggestion) {
    parts.push(`  Suggestion: ${issue.suggestion}`);
  }

  return parts.join("\n");
}

function collectIssuesBySeverity(
  report: AgentDoctorReport,
  severity: IssueSeverity,
): AgentDoctorIssue[] {
  return report.issues.filter((issue) => issue.severity === severity);
}

export function formatCodexReport(report: AgentDoctorReport): string {
  const sections: string[] = [
    "# Agent Doctor Summary",
    "",
    "Repository facts currently contradict parts of the instruction set. Prefer repository facts over stale instruction text until the findings below are resolved.",
    "",
    "## Important findings",
  ];

  for (const severity of ["error", "warning", "info"] as const) {
    const issues = collectIssuesBySeverity(report, severity);

    if (issues.length === 0) {
      continue;
    }

    sections.push(
      "",
      `### ${severity[0]!.toUpperCase()}${severity.slice(1)}s`,
      issues.map(formatIssue).join("\n"),
    );
  }

  if (report.issues.length === 0) {
    sections.push("", "- No issues found. The scanned instructions match repository facts.");
  }

  sections.push(
    "",
    "## Recommended behavior for the agent",
    "",
    "- Prefer repository facts over stale instructions while findings remain.",
    "- Update instruction files before making architecture-affecting changes based on contradicted guidance.",
    "- Ask for confirmation before broader tooling or architecture changes when the instructions and repository diverge.",
    "",
    "## Task",
    "",
    "Update the affected instruction files or the repository so the referenced paths, commands, and tools match. Verify the impacted files, scripts, and dependencies, then rerun `agent-doctor`.",
    "",
    "## After changes",
    "",
    "Rerun `agent-doctor` or `agent-doctor --ci` and confirm that the issue count drops.",
  );

  return sections.join("\n");
}
