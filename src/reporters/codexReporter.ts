import type { AgentLintIssue, AgentLintReport } from "../types.ts";

function pushGroup<K, V>(groups: Map<K, V[]>, key: K, value: V): void {
  const bucket = groups.get(key) ?? [];
  bucket.push(value);
  groups.set(key, bucket);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function joinWithAnd(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatCodeList(values: string[]): string {
  return joinWithAnd(values.map((value) => `\`${value}\``));
}

function formatLineRanges(lines: number[]): string {
  const sortedLines = unique(lines).sort((left, right) => left - right);
  const ranges: string[] = [];

  for (const line of sortedLines) {
    const lastRange = ranges.at(-1);

    if (!lastRange) {
      ranges.push(String(line));
      continue;
    }

    const [startText, endText] = lastRange.split("-");
    const end = Number(endText ?? startText);

    if (line === end + 1) {
      const start = Number(startText);
      ranges[ranges.length - 1] = `${start}-${line}`;
      continue;
    }

    ranges.push(String(line));
  }

  return ranges.join(", ");
}

function formatLineLabel(issues: AgentLintIssue[]): string {
  const lines = issues.flatMap((issue) => (issue.line ? [issue.line] : []));

  if (lines.length === 0) {
    return "unknown lines";
  }

  return `${unique(lines).length === 1 ? "line" : "lines"} ${formatLineRanges(lines)}`;
}

function trimSentence(value: string): string {
  return value.replace(/\.+$/u, "");
}

function lowerCaseFirst(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toLowerCase()}${value.slice(1)}`;
}

function minLine(issues: AgentLintIssue[]): number {
  return Math.min(...issues.map((issue) => issue.line ?? Number.MAX_SAFE_INTEGER));
}

function parseMissingScriptFact(
  repoFact: string,
): { packageJsonPath: string; scriptName: string } | null {
  const match =
    /^(?<packageJsonPath>.+) has no "(?<scriptName>.+)" script\.$/u.exec(repoFact)?.groups;

  if (!match?.packageJsonPath || !match.scriptName) {
    return null;
  }

  return {
    packageJsonPath: match.packageJsonPath,
    scriptName: match.scriptName,
  };
}

function buildActionableGroupKey(issue: AgentLintIssue): string {
  if (issue.rule === "missingPackageScripts") {
    const parsed = parseMissingScriptFact(issue.evidence.repoFact);

    if (parsed) {
      return `${issue.rule}:${parsed.packageJsonPath}`;
    }
  }

  return `${issue.rule}:${issue.message}:${issue.referenceKind ?? ""}`;
}

function summarizeMissingScriptIssues(issues: AgentLintIssue[]): string {
  const parsedFacts = issues
    .map((issue) => parseMissingScriptFact(issue.evidence.repoFact))
    .filter((value): value is { packageJsonPath: string; scriptName: string } => value !== null);

  if (parsedFacts.length !== issues.length) {
    return `${lowerCaseFirst(issues[0]!.message)} at ${formatLineLabel(issues)}: ${joinWithAnd(unique(issues.map((issue) => trimSentence(issue.evidence.repoFact))))}`;
  }

  const packageJsonPaths = unique(parsedFacts.map((fact) => fact.packageJsonPath));
  const scripts = unique(parsedFacts.map((fact) => fact.scriptName));
  const packageJsonLabel =
    packageJsonPaths.length === 1 ? ` in \`${packageJsonPaths[0]}\`` : "";

  return `missing package scripts${packageJsonLabel} at ${formatLineLabel(issues)}: ${formatCodeList(scripts)}`;
}

function summarizeGenericIssues(issues: AgentLintIssue[]): string {
  const repoFacts = unique(issues.map((issue) => trimSentence(issue.evidence.repoFact)));
  return `${lowerCaseFirst(issues[0]!.message)} at ${formatLineLabel(issues)}: ${joinWithAnd(repoFacts)}`;
}

function summarizeActionableFileIssues(issues: AgentLintIssue[]): string {
  const groups = new Map<string, AgentLintIssue[]>();

  for (const issue of issues) {
    pushGroup(groups, buildActionableGroupKey(issue), issue);
  }

  return [...groups.values()]
    .sort((left, right) => minLine(left) - minLine(right))
    .map((group) =>
      group[0]!.rule === "missingPackageScripts"
        ? summarizeMissingScriptIssues(group)
        : summarizeGenericIssues(group),
    )
    .join("; ");
}

function summarizeActionableIssues(issues: AgentLintIssue[]): string[] {
  const files = new Map<string, AgentLintIssue[]>();

  for (const issue of issues) {
    pushGroup(files, issue.sourceFile, issue);
  }

  return [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([sourceFile, fileIssues]) =>
        `- \`${sourceFile}\`: ${summarizeActionableFileIssues(fileIssues)}`,
    );
}

function buildInfoGroupKey(issue: AgentLintIssue): string {
  if (issue.rule === "brokenFileReferences" && issue.referenceKind === "external") {
    return "external-repository-reference";
  }

  return `${issue.rule}:${issue.message}:${issue.referenceKind ?? ""}:${trimSentence(issue.evidence.repoFact)}`;
}

function formatInfoLocations(issues: AgentLintIssue[]): string {
  const files = new Map<string, AgentLintIssue[]>();

  for (const issue of issues) {
    pushGroup(files, issue.sourceFile, issue);
  }

  return [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sourceFile, fileIssues]) => `\`${sourceFile}\` (${formatLineLabel(fileIssues)})`)
    .join("; ");
}

function summarizeInfoGroup(issues: AgentLintIssue[]): string {
  const firstIssue = issues[0]!;

  if (firstIssue.rule === "brokenFileReferences" && firstIssue.referenceKind === "external") {
    return `- external repository references could not be validated locally: ${formatInfoLocations(issues)}`;
  }

  return `- ${lowerCaseFirst(firstIssue.message)}: ${formatInfoLocations(issues)}`;
}

export function formatCodexReport(report: AgentLintReport): string {
  if (report.issues.length === 0) {
    return "# Agent Lint\n\nNo issues found. The scanned instructions match repository facts.";
  }

  const actionableIssues = report.issues.filter((issue) => issue.severity !== "info");
  const infoIssues = report.issues.filter((issue) => issue.severity === "info");
  const lines: string[] = ["# Agent Lint", ""];

  if (actionableIssues.length > 0) {
    lines.push(`Actionable issues: ${actionableIssues.length}`, "", "Files to update:");
    lines.push(...summarizeActionableIssues(actionableIssues));
  } else {
    lines.push("No actionable issues.");
  }

  if (infoIssues.length > 0) {
    const infoGroups = new Map<string, AgentLintIssue[]>();

    for (const issue of infoIssues) {
      pushGroup(infoGroups, buildInfoGroupKey(issue), issue);
    }

    lines.push("", "Non-blocking notes:");
    lines.push(
      ...[...infoGroups.values()]
        .sort((left, right) => minLine(left) - minLine(right))
        .map(summarizeInfoGroup),
    );
  }

  lines.push("", "Next step: update the instruction files to match the repository, then rerun `agent-lint`.");

  return lines.join("\n");
}
