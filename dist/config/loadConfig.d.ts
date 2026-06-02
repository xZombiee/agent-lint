import type { ResolvedAgentLintConfig } from "../types.ts";
export declare function loadConfig(projectRoot: string, explicitConfigPath?: string): Promise<ResolvedAgentLintConfig>;
