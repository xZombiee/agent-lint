import type { PackageJsonData, ScanContext } from "../types.ts";
export interface PackageJsonMatch {
    path: string;
    data: PackageJsonData;
}
export declare function findNearestPackageJson(context: ScanContext, sourceFile: string): PackageJsonMatch | null;
