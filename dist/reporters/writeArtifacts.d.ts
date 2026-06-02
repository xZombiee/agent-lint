import type { AgentLintReport } from "../types.ts";
export declare function writeArtifacts(projectRoot: string, artifactDir: string, report: AgentLintReport, codexSummary: string): Promise<{
    reportPath: string;
    summaryPath: string;
}>;
