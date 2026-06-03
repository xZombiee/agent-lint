import type { PackageJsonData, RepoFacts } from "../types.ts";
export declare function buildRepoFacts(projectRoot: string, repoFiles: string[], packageJson: PackageJsonData | null): Promise<RepoFacts>;
