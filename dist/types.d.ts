export type IssueSeverity = "info" | "warning" | "error";
export type ReferenceKind = "hard" | "example" | "policy" | "env" | "external";
export type PathTargetKind = "file" | "dir" | "path";
export type RuleName = "brokenFileReferences" | "missingPackageScripts" | "toolMismatch" | "explicitContradictions" | "packageManagerMismatch" | "runtimeMismatch" | "ciReferenceMismatch";
export type OutputMode = "terminal" | "json" | "codex";
export type RuleToggleMap = Record<RuleName, boolean>;
export type RuleSeverityMap = Record<RuleName, IssueSeverity>;
export interface AgentLintConfig {
    instructionFiles?: string[];
    ignorePaths?: string[];
    artifactDir?: string;
    rules?: Partial<RuleToggleMap>;
    severity?: Partial<RuleSeverityMap>;
}
export interface ResolvedAgentLintConfig {
    instructionFiles: string[];
    ignorePaths: string[];
    artifactDir: string;
    rules: RuleToggleMap;
    severity: RuleSeverityMap;
}
export interface AgentLintIssue {
    id: string;
    rule: RuleName;
    severity: IssueSeverity;
    sourceFile: string;
    line?: number;
    message: string;
    referenceKind?: ReferenceKind;
    evidence: {
        instructionText: string;
        repoFact: string;
    };
    suggestion?: string;
    suggestions?: string[];
}
export interface AgentLintReport {
    projectRoot: string;
    scannedFiles: string[];
    summary: {
        issueCount: number;
        infoCount: number;
        warningCount: number;
        errorCount: number;
    };
    issues: AgentLintIssue[];
}
export interface PackageJsonData {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    engines?: Record<string, string>;
    packageManager?: string;
}
export interface PackageJsonRecord {
    path: string;
    data: PackageJsonData;
}
export interface FileReference {
    path: string;
    rawPath: string;
    line: number;
    instructionText: string;
    token: string;
    kind: ReferenceKind;
    target: PathTargetKind;
    section?: string;
    contextDirectory?: string;
}
export interface GitIgnoreRule {
    pattern: string;
    basePath: string;
    source: string;
}
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export interface ScriptCommand {
    packageManager: PackageManager;
    scriptName: string;
    rawCommand: string;
    line: number;
    instructionText: string;
    explicitRun: boolean;
    workingDirectory?: string;
}
export interface PackageManagerMention {
    packageManager: PackageManager;
    rawCommand: string;
    line: number;
    instructionText: string;
}
export type RuntimeName = "node" | "python" | "java";
export interface RuntimeMention {
    runtime: RuntimeName;
    version: string;
    line: number;
    instructionText: string;
}
export type CiProvider = "github-actions" | "circleci" | "gitlab-ci" | "vercel" | "netlify";
export type CiMentionKind = "provider" | "workflow" | "job";
export interface CiMention {
    provider: CiProvider;
    kind: CiMentionKind;
    name?: string;
    line: number;
    instructionText: string;
}
export type SupportedToolKey = "jest" | "vitest" | "playwright" | "cypress" | "redux" | "zustand" | "eslint" | "biome" | "prettier" | "tailwind" | "prisma" | "drizzle" | "nextjs" | "vite";
export type ToolCategory = "testRunner" | "e2e" | "state" | "lint" | "format" | "styling" | "orm" | "app";
export interface ToolDefinition {
    key: SupportedToolKey;
    name: string;
    packages: string[];
    category: ToolCategory;
}
export type ToolStance = "use" | "avoid" | "mention";
export interface ToolMention {
    tool: SupportedToolKey;
    toolName: string;
    line: number;
    instructionText: string;
    stance: ToolStance;
}
export type ContradictionSignal = {
    kind: "requireTool";
    tool: SupportedToolKey;
    line: number;
    instructionText: string;
} | {
    kind: "forbidTool";
    tool: SupportedToolKey;
    line: number;
    instructionText: string;
} | {
    kind: "requireCommand";
    packageManager: PackageManager;
    scriptName: string;
    line: number;
    instructionText: string;
};
export interface ParsedInstructionFile {
    path: string;
    content: string;
    fileReferences: FileReference[];
    commands: ScriptCommand[];
    packageManagerMentions: PackageManagerMention[];
    runtimeMentions: RuntimeMention[];
    ciMentions: CiMention[];
    toolMentions: ToolMention[];
    contradictionSignals: ContradictionSignal[];
}
export interface ToolEvidence {
    packages: string[];
    configFiles: string[];
}
export interface RuntimeFact {
    source: string;
    version: string;
}
export interface CiFacts {
    providers: CiProvider[];
    githubWorkflowFiles: string[];
    githubWorkflowNames: string[];
    githubJobIds: string[];
}
export interface RepoFacts {
    packageManagers: {
        declared?: PackageManager;
        lockfiles: Record<PackageManager, string[]>;
        workspaceFiles: string[];
    };
    tools: Partial<Record<SupportedToolKey, ToolEvidence>>;
    runtimes: Partial<Record<RuntimeName, RuntimeFact[]>>;
    ci: CiFacts;
}
export interface ScanContext {
    projectRoot: string;
    config: ResolvedAgentLintConfig;
    repoFiles: string[];
    repoDirectories: string[];
    gitIgnoreRules: GitIgnoreRule[];
    trackedPaths: string[];
    packageJson: PackageJsonData | null;
    packageJsons: PackageJsonRecord[];
    repoFacts: RepoFacts;
    instructionFiles: ParsedInstructionFile[];
}
export interface RunOptions {
    projectRoot?: string;
    configPath?: string;
    outputMode?: OutputMode;
    ci?: boolean;
    writeSummary?: boolean;
}
export interface RunResult {
    report: AgentLintReport;
    outputs: Record<OutputMode, string>;
    artifactPaths?: {
        reportPath: string;
        summaryPath: string;
    };
    exitCode: number;
}
