import path from "node:path";
import { defaultConfig } from "./config/defaultConfig.js";
import { loadConfig } from "./config/loadConfig.js";
import { buildScanContext } from "./scanner/buildScanContext.js";
import { formatCodexReport } from "./reporters/codexReporter.js";
import { formatJsonReport } from "./reporters/jsonReporter.js";
import { formatTerminalReport } from "./reporters/terminalReporter.js";
import { writeArtifacts } from "./reporters/writeArtifacts.js";
import { brokenFileReferences } from "./rules/brokenFileReferences.js";
import { explicitContradictions } from "./rules/explicitContradictions.js";
import { missingPackageScripts } from "./rules/missingPackageScripts.js";
import { toolMismatch } from "./rules/toolMismatch.js";
const RULE_IMPLEMENTATIONS = {
    brokenFileReferences,
    missingPackageScripts,
    toolMismatch,
    explicitContradictions,
};
const SEVERITY_ORDER = {
    error: 0,
    warning: 1,
    info: 2,
};
function sortIssues(issues) {
    return [...issues].sort((left, right) => {
        return (SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
            left.sourceFile.localeCompare(right.sourceFile) ||
            (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER) ||
            left.id.localeCompare(right.id));
    });
}
function applySeverityOverride(issues, ruleName, severity) {
    return issues.map((issue) => ({
        ...issue,
        severity: issue.severity === defaultConfig.severity[ruleName] ? severity : issue.severity,
    }));
}
function buildReport(projectRoot, scannedFiles, issues) {
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
export async function runAgentLint(options = {}) {
    const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
    const config = await loadConfig(projectRoot, options.configPath);
    const context = await buildScanContext(projectRoot, config);
    const issues = sortIssues(Object.entries(RULE_IMPLEMENTATIONS).flatMap(([ruleName, implementation]) => {
        if (!config.rules[ruleName]) {
            return [];
        }
        return applySeverityOverride(implementation(context), ruleName, config.severity[ruleName]);
    }));
    const report = buildReport(projectRoot, context.instructionFiles.map((instructionFile) => instructionFile.path), issues);
    const outputs = {
        terminal: formatTerminalReport(report),
        json: formatJsonReport(report),
        codex: formatCodexReport(report),
    };
    const artifactPaths = options.writeSummary
        ? await writeArtifacts(projectRoot, config.artifactDir, report, outputs.codex)
        : undefined;
    const result = {
        report,
        outputs,
        exitCode: options.ci && report.summary.issueCount > 0 ? 1 : 0,
    };
    if (artifactPaths) {
        result.artifactPaths = artifactPaths;
    }
    return result;
}
//# sourceMappingURL=index.js.map