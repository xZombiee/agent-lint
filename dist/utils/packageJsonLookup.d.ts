import type { PackageJsonData, ScanContext, ScriptCommand } from "../types.ts";
export interface PackageJsonMatch {
    path: string;
    data: PackageJsonData;
}
export declare function findNearestPackageJson(context: ScanContext, sourceFile: string): PackageJsonMatch | null;
export declare function findPackageJsonForCommand(context: ScanContext, sourceFile: string, command: ScriptCommand): PackageJsonMatch | null;
