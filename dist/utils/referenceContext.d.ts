import type { PathTargetKind, ReferenceKind } from "../types.ts";
export declare function classifyReferenceContext(line: string, section?: string): ReferenceKind;
export declare function detectPathTargetKind(rawPath: string): PathTargetKind;
