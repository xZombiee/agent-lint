import type { PackageJsonData } from "../types.ts";
export declare function readPackageJson(projectRoot: string): Promise<PackageJsonData | null>;
