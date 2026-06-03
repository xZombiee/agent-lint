import path from "node:path";
import { defaultConfig } from "./config/defaultConfig.ts";
import { loadConfig } from "./config/loadConfig.ts";
import { buildScanContext } from "./scanner/buildScanContext.ts";
import { formatCodexReport } from "./reporters/codexReporter.ts";
import { formatJsonReport } from "./reporters/jsonReporter.ts";
import { formatTerminalReport } from "./reporters/terminalReporter.ts";
import { writeArtifacts } from "./reporters/writeArtifacts.ts";
import { brokenFileReferences } from "./rules/brokenFileReferences.ts";
import { ciReferenceMismatch } from "./rules/ciReferenceMismatch.ts";
import { explicitContradictions } from "./rules/explicitContradictions.ts";
import { missingPackageScripts } from "./rules/missingPackageScripts.ts";
import { packageManagerMismatch } from "./rules/packageManagerMismatch.ts";
import { runtimeMismatch } from "./rules/runtimeMismatch.ts";
import { toolMismatch } from "./rules/toolMismatch.ts";
import type {
  AgentLintIssue,
  AgentLintReport,
  IssueSeverity,
  RuleName,
  RunOptions,
  RunResult,
  ScanContext,
} from "./types.ts";

type RuleImplementation = (context: ScanContext) => AgentLintIssue[];

const RULE_IMPLEMENTATIONS: Record<RuleName, RuleImplementation> = {
  brokenFileReferences,
  missingPackageScripts,
  toolMismatch,
  explicitContradictions,
  packageManagerMismatch,
  runtimeMismatch,
  ciReferenceMismatch,
};

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

function sortIssues(issues: AgentLintIssue[]): AgentLintIssue[] {
  return [...issues].sort((left, right) => {
    return (
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
      left.sourceFile.localeCompare(right.sourceFile) ||
      (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id)
    );
  });
}

function applySeverityOverride(
  issues: AgentLintIssue[],
  ruleName: RuleName,
  severity: IssueSeverity,
): AgentLintIssue[] {
  return issues.map((issue) => ({
    ...issue,
    severity:
      issue.severity === defaultConfig.severity[ruleName] ? severity : issue.severity,
  }));
}

function buildReport(projectRoot: string, scannedFiles: string[], issues: AgentLintIssue[]): AgentLintReport {
  return {
    projectRoot,
    scannedFiles,
    summary: {
      issueCount: issues.length,
      infoCount: issues.filter((issue) => issue.severity === "info").length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
      errorCount: issues.filter((issue) => issue.severity === "error").length,
    },
    issues,
  };
}

export async function runAgentLint(options: RunOptions = {}): Promise<RunResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const config = await loadConfig(projectRoot, options.configPath);
  const context = await buildScanContext(projectRoot, config);

  const issues = sortIssues(
    Object.entries(RULE_IMPLEMENTATIONS).flatMap(([ruleName, implementation]) => {
      if (!config.rules[ruleName as RuleName]) {
        return [];
      }

      return applySeverityOverride(
        implementation(context),
        ruleName as RuleName,
        config.severity[ruleName as RuleName],
      );
    }),
  );

  const report = buildReport(
    projectRoot,
    context.instructionFiles.map((instructionFile) => instructionFile.path),
    issues,
  );

  const outputs = {
    terminal: formatTerminalReport(report),
    json: formatJsonReport(report),
    codex: formatCodexReport(report),
  };

  const artifactPaths = options.writeSummary
    ? await writeArtifacts(projectRoot, config.artifactDir, report, outputs.codex)
    : undefined;

  const result: RunResult = {
    report,
    outputs,
    exitCode: options.ci && report.summary.issueCount > 0 ? 1 : 0,
  };

  if (artifactPaths) {
    result.artifactPaths = artifactPaths;
  }

  return result;
}

export type {
  AgentLintConfig,
  AgentLintIssue,
  AgentLintReport,
  OutputMode,
  RunOptions,
  RunResult,
} from "./types.ts";
