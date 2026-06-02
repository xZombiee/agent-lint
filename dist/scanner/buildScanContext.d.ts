import type { ResolvedAgentLintConfig, ScanContext } from "../types.ts";
export declare function buildScanContext(projectRoot: string, config: ResolvedAgentLintConfig): Promise<ScanContext>;
