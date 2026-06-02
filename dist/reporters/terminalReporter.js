import { blue, green, red, resolveColorUsage, yellow, } from "../utils/terminalColors.js";
const RULE_TITLES = {
    brokenFileReferences: "Broken file reference",
    missingPackageScripts: "Missing package script",
    toolMismatch: "Tool mismatch",
    explicitContradictions: "Explicit contradiction",
};
function formatCount(label, value) {
    return `${value} ${label}${value === 1 ? "" : "s"}`;
}
function formatLocation(issue) {
    return issue.line ? `${issue.sourceFile}:${issue.line}` : issue.sourceFile;
}
function colorSeverity(value, severity, useColor) {
    if (severity === "error") {
        return red(value, { useColor });
    }
    if (severity === "warning") {
        return yellow(value, { useColor });
    }
    return blue(value, { useColor });
}
function colorSummaryCount(label, count, useColor) {
    if (label === "error") {
        return red(`${count} ${label}`, { useColor });
    }
    if (label === "warning") {
        return yellow(`${count} ${label}`, { useColor });
    }
    return blue(`${count} ${label}`, { useColor });
}
export function formatTerminalReport(report, options) {
    const useColor = resolveColorUsage(options);
    const lines = [
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
        lines.push("", `${severityLabel} ${formatLocation(issue)} ${RULE_TITLES[issue.rule]}${kindLabel}`, `Instruction says: ${issue.evidence.instructionText}`, `Repo fact: ${issue.evidence.repoFact}`);
        if (issue.suggestion) {
            lines.push(`Suggestion: ${issue.suggestion}`);
        }
    }
    lines.push("", "Next step:", "Run agent-lint --codex to generate an agent-ready remediation summary.");
    return lines.join("\n");
}
//# sourceMappingURL=terminalReporter.js.map