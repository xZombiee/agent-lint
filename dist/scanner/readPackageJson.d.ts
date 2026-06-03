import type { PackageJsonData, PackageJsonRecord } from "../types.ts";
export declare function readPackageJson(projectRoot: string): Promise<PackageJsonData | null>;
export declare function readPackageJsonAt(projectRoot: string, relativePath: string): Promise<PackageJsonData | null>;
export declare function readPackageJsonRecords(projectRoot: string, repoFiles: string[]): Promise<PackageJsonRecord[]>;
