import type { AgentLintConfig, ResolvedAgentLintConfig } from "../types.ts";
export declare function parseConfigObject(rawConfig: unknown): AgentLintConfig;
export declare function resolveConfig(config?: AgentLintConfig): ResolvedAgentLintConfig;
