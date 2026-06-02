import type { GitIgnoreRule, PathTargetKind } from "../types.ts";
export declare function isPathIgnoredByRules(candidatePath: string, target: PathTargetKind, rules: GitIgnoreRule[]): boolean;
export declare function isTrackedPath(candidatePath: string, target: PathTargetKind, trackedPaths: string[]): boolean;
export declare function readGitIgnoreRules(projectRoot: string, repoFiles: string[]): Promise<GitIgnoreRule[]>;
export declare function listTrackedPaths(projectRoot: string): Promise<string[]>;
