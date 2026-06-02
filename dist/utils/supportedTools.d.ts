import type { PackageJsonData, SupportedToolKey, ToolDefinition } from "../types.ts";
export declare const SUPPORTED_TOOLS: ToolDefinition[];
export declare function getToolDefinition(toolKey: SupportedToolKey): ToolDefinition;
export declare function getInstalledToolKeys(packageJson: PackageJsonData | null): Set<SupportedToolKey>;
export declare function getInstalledPackagesForTool(packageJson: PackageJsonData | null, toolKey: SupportedToolKey): string[];
export declare function getAlternativeTools(toolKey: SupportedToolKey): ToolDefinition[];
