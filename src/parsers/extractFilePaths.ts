import type { FileReference, ReferenceKind } from "../types.ts";
import {
  classifyReferenceContext,
  detectPathTargetKind,
} from "../utils/referenceContext.ts";

const KNOWN_ROOT_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "README.md",
  "LICENSE",
  "AGENTS.md",
  "CLAUDE.md",
  ".gitignore",
]);

const STRONG_CODE_ROOT_SEGMENTS = new Set([
  ".github",
  "apps",
  "assets",
  "extensions",
  "packages",
  "scripts",
  "src",
]);

const WEAK_CODE_ROOT_SEGMENTS = new Set([
  "app",
  "bin",
  "cmd",
  "docs",
  "examples",
  "fixtures",
  "internal",
  "lib",
  "package",
  "public",
  "test",
  "tests",
  "ui",
]);

const EXTERNAL_REFERENCE_CONTEXT =
  /\b(another repo|external repo|owner repos?|publish repo|mirror build|see its|see their|route to|routes to|separate repo|cloned locally as)\b/iu;
const EXTERNAL_LOCAL_PATH_CONTEXT =
  /\bin (?:the )?(?:separate )?publish repo\b|\bin (?:the )?separate [^.,;:]+ repo\b/iu;
const COMMON_ABBREVIATION_TOKENS = new Set(["e.g", "i.e", "vs."]);
const KNOWN_FILE_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "css",
  "d.ts",
  "go",
  "h",
  "html",
  "java",
  "js",
  "json",
  "jsonl",
  "jsx",
  "md",
  "mdx",
  "mjs",
  "png",
  "py",
  "rs",
  "scss",
  "sh",
  "ts",
  "tsx",
  "toml",
  "yaml",
  "yml",
]);

interface PathToken {
  raw: string;
  start: number;
}

function sanitizeToken(token: string): string {
  let value = token.trim();

  const wrapperPairs: Array<[string, string]> = [
    ["`", "`"],
    ['"', '"'],
    ["'", "'"],
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
    ["<", ">"],
  ];

  let changed = true;
  while (changed && value.length > 1) {
    changed = false;
    value = value.replace(/[.,;:!?]+(?=\*+$)/u, "");
    value = value.replace(/[.,;:!?]+$/u, "");
    value = value.replace(/^\*+(?=[`"([{<])/u, "");
    value = value.replace(/(?<=[`"')\]}>])\*+$/u, "");
    value = value.replace(/^[`"'([{]+/u, "");
    value = value.replace(/[`"')\]}]+$/u, "");

    if (/^\*+[A-Za-z]/u.test(value)) {
      value = value.replace(/^\*+/u, "");
      changed = true;
    }

    value = value.replace(/[.,;:!?]+(?=\*+$)/u, "");

    if (/[A-Za-z]\*+$/u.test(value)) {
      value = value.replace(/\*+$/u, "");
      changed = true;
    }

    for (const [prefix, suffix] of wrapperPairs) {
      if (value.startsWith(prefix) && value.endsWith(suffix)) {
        value = value.slice(prefix.length, value.length - suffix.length).trim();
        changed = true;
        break;
      }
    }
  }

  return value.replace(/[.,;:!?]+$/u, "");
}

function stripLineNumberSuffix(token: string): string {
  const withExtensionMatch =
    /^(?<path>.+\.[A-Za-z0-9._-]{1,12}):\d+$/u.exec(token)?.groups?.path;

  if (withExtensionMatch) {
    return withExtensionMatch;
  }

  const slashPathMatch = /^(?<path>.+\/[^/]+):\d+$/u.exec(token)?.groups?.path;

  return slashPathMatch ?? token;
}

function normalizePathToken(token: string, options?: { preserveLeadingSlash?: boolean }): string {
  const normalized = token.replace(/\\/gu, "/");

  if (options?.preserveLeadingSlash) {
    return normalized;
  }

  return normalized.replace(/^\/+/u, "");
}

function splitPathSegments(candidatePath: string): string[] {
  return candidatePath.split("/").filter((segment) => segment !== "");
}

function hasFileExtension(candidatePath: string): boolean {
  const segments = splitPathSegments(candidatePath);
  const lastSegment = segments[segments.length - 1] ?? candidatePath;
  return /^[A-Za-z0-9._-]+\.[A-Za-z][A-Za-z0-9_-]{0,11}$/u.test(lastSegment);
}

function hasGlob(candidatePath: string): boolean {
  return /[*?]/u.test(candidatePath);
}

function hasRelativePrefix(candidatePath: string): boolean {
  return candidatePath.startsWith("./") || candidatePath.startsWith("../");
}

function hasDotSegment(candidatePath: string): boolean {
  return splitPathSegments(candidatePath).some((segment) => segment.startsWith("."));
}

function hasCodeLikeSegment(candidatePath: string): boolean {
  return splitPathSegments(candidatePath).some((segment) => /[_-]|\d/u.test(segment));
}

function isWordLikeSegment(segment: string): boolean {
  return /^[A-Za-z][A-Za-z-]*$/u.test(segment);
}

function isWordSlashPhrase(candidatePath: string): boolean {
  const segments = splitPathSegments(candidatePath);

  return (
    segments.length >= 2 &&
    segments.every((segment) => isWordLikeSegment(segment))
  );
}

function hasPlaceholderSyntax(candidatePath: string): boolean {
  return (
    /<[^>]*>/u.test(candidatePath) ||
    candidatePath.includes("<") ||
    candidatePath.includes(">") ||
    candidatePath.includes("{") ||
    candidatePath.includes("}")
  );
}

function isLiteralExtensionToken(candidatePath: string): boolean {
  return /^\.[A-Za-z]{1,8}$/u.test(candidatePath);
}

function isEllipsisToken(candidatePath: string): boolean {
  return /^\.{3,}$/u.test(candidatePath) || /(^|\/)\.{3,}(\/|$)/u.test(candidatePath);
}

function isConfigKeyToken(candidatePath: string): boolean {
  if (candidatePath.includes("/") || KNOWN_ROOT_FILES.has(candidatePath)) {
    return false;
  }

  const segments = candidatePath.split(".");
  const extension = segments.slice(1).join(".").toLowerCase();

  if (KNOWN_FILE_EXTENSIONS.has(extension) || KNOWN_FILE_EXTENSIONS.has(segments.at(-1)?.toLowerCase() ?? "")) {
    return false;
  }

  return (
    segments.length >= 2 &&
    segments.every((segment) => /^[A-Za-z_$][A-Za-z0-9_$-]*(?:\[\])?$/u.test(segment))
  );
}

function isCommonAbbreviationToken(candidatePath: string): boolean {
  return COMMON_ABBREVIATION_TOKENS.has(candidatePath.toLowerCase());
}

function isRuntimeAdjectiveToken(candidatePath: string): boolean {
  return /^(?:Node\.js|VS\.Code)(?:-[A-Za-z]+)?$/u.test(candidatePath);
}

function isAllowedBareDotfile(candidatePath: string): boolean {
  return new Set([
    ".env",
    ".env.local",
    ".eslintrc",
    ".gitignore",
    ".npmrc",
    ".prettierrc",
    ".yarnrc",
  ]).has(candidatePath);
}

function isBareConfigExample(candidatePath: string, line: string): boolean {
  if (candidatePath.includes("/") || KNOWN_ROOT_FILES.has(candidatePath)) {
    return false;
  }

  if (!/^[A-Za-z0-9_-]+\.(json|ya?ml|toml)$/iu.test(candidatePath)) {
    return false;
  }

  return /\b(configure|configuration|config|settings|defaults?|env|environment)\b/iu.test(
    line,
  );
}

function isRuntimeGeneratedArtifact(candidatePath: string, line: string): boolean {
  if (candidatePath.includes("/") || !hasFileExtension(candidatePath)) {
    return false;
  }

  return /\b(generated|runtime|persistence|persisted|stores?|stored|storage|cache|event stream|events?|sample|fixtures?|global storage|created|written)\b/iu.test(
    line,
  );
}

function isGenericRuntimeFileReference(candidatePath: string, line: string): boolean {
  return (
    candidatePath === "CLAUDE.md" &&
    /\b(memory files?|memory command|user memory|open memory)\b/iu.test(line)
  );
}

function isTemplateVersionToken(candidatePath: string): boolean {
  return /^v?[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9-]*)+(?:-[A-Za-z0-9.-]+)?$/u.test(
    candidatePath,
  );
}

function isNumericVersionToken(candidatePath: string): boolean {
  return /^\d+(?:\.\d+|\.x)+(?:-[A-Za-z0-9.-]+)?$/iu.test(candidatePath);
}

function isModelVersionToken(candidatePath: string): boolean {
  return /^[A-Za-z][A-Za-z0-9-]*-\d+(?:\.\d+|\.x)+(?:-[A-Za-z0-9.-]+)?$/iu.test(
    candidatePath,
  );
}

function isVersionLikeToken(candidatePath: string): boolean {
  return (
    isTemplateVersionToken(candidatePath) ||
    isNumericVersionToken(candidatePath) ||
    isModelVersionToken(candidatePath)
  );
}

function isMarkdownInventoryLine(line: string): boolean {
  return (
    /^\s*[-*]\s+(?:\*\*)?`[^`]+`(?:\*\*)?\s*[:—-]/u.test(line) ||
    /^\s*\|[^|\n]*`[^`]+`[^|\n]*\|/u.test(line)
  );
}

function isDirectoryInventoryReference(candidatePath: string, line: string): boolean {
  return candidatePath.endsWith("/") && isMarkdownInventoryLine(line);
}

function isSchemaPatternReference(candidatePath: string, line: string): boolean {
  return hasGlob(candidatePath) && /^\s*\|[^|\n]*`[^`]+`[^|\n]*\|/u.test(line);
}

function isTreeDiagramDirectoryReference(candidatePath: string, line: string): boolean {
  const trimmedLine = line.trim();

  return (
    candidatePath.endsWith("/") &&
    (trimmedLine === candidatePath ||
      /^[│├└─\s]*[A-Za-z0-9._-]+\/(?:\s*#.*)?$/u.test(trimmedLine))
  );
}

function isReferenceConfigExampleLine(line: string): boolean {
  return /^\s*(?:command|pattern|schema|location|path)\s*:\s*["']?/iu.test(line);
}

function isPackageImportSpecifier(candidatePath: string): boolean {
  if (
    hasRelativePrefix(candidatePath) ||
    candidatePath.startsWith("/") ||
    candidatePath.startsWith(".") ||
    hasFileExtension(candidatePath)
  ) {
    return false;
  }

  const segments = splitPathSegments(candidatePath);
  const firstSegment = segments[0]?.toLowerCase() ?? "";

  return (
    segments.length >= 2 &&
    segments.length <= 3 &&
    !STRONG_CODE_ROOT_SEGMENTS.has(firstSegment) &&
    !WEAK_CODE_ROOT_SEGMENTS.has(firstSegment) &&
    segments.every((segment, index) =>
      index === segments.length - 1 && segment === "*"
        ? true
        : /^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(segment),
    )
  );
}

function isPackageExportSubpathReference(candidatePath: string, line: string): boolean {
  return (
    /^\.\/[A-Za-z0-9._-]+$/u.test(candidatePath) &&
    /\b(exports?|subpath|entrypoints?|package)\b/iu.test(line)
  );
}

function isNamingConventionExample(candidatePath: string, line: string): boolean {
  return (
    !candidatePath.includes("/") &&
    hasFileExtension(candidatePath) &&
    /\b(kebab-case|snake_case|pascalcase|camelcase|naming|file names?|filenames?|examples?)\b/iu.test(
      line,
    ) &&
    !hasHardRequirementCue(line)
  );
}

function isLibraryOrFrameworkToken(candidatePath: string, line: string): boolean {
  return (
    !candidatePath.includes("/") &&
    /^[a-z][a-z0-9-]*\.js$/u.test(candidatePath) &&
    /\b(framework|frameworks|libraries|library|package|packages|dependency|dependencies|stack|sdk|integration|runtime|tooling|hardhat|ethers|typescript)\b/iu.test(
      line,
    ) &&
    !hasHardRequirementCue(line)
  );
}

function isPlaceholderImportSnippet(candidatePath: string, line: string): boolean {
  const basename = splitPathSegments(candidatePath).at(-1) ?? candidatePath;

  return (
    /^[A-Z][A-Za-z0-9]*\.[A-Za-z0-9]+$/u.test(basename) &&
    /\b(import|imports|named imports?|placeholder|example)\b/iu.test(line)
  );
}

function isVariantQualifiedPathReference(candidatePath: string, line: string): boolean {
  const escapedPath = candidatePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

  return (
    new RegExp(`\`${escapedPath}\`\\s*\\([^)]*(?:/|\\|)[^)]*\\)`, "u").test(line) &&
    /\b(appropriate|variant|variants|one of|choose|common|node|browser|vscode)\b/iu.test(line)
  );
}

function isShellRecursiveGlob(candidatePath: string): boolean {
  return candidatePath === "./..." || candidatePath === "..." || candidatePath === "./";
}

function extractMarkdownLinkTargets(line: string): string[] {
  const matches = line.matchAll(/\[[^\]]+\]\((?<target>[^)\s]+)\)/gu);
  const targets: string[] = [];

  for (const match of matches) {
    const target = match.groups?.target;

    if (!target) {
      continue;
    }

    targets.push(target.replace(/[?#].*$/u, ""));
  }

  return targets;
}

function stripMarkdownLinks(line: string): string {
  return line.replace(/\[[^\]]+\]\(([^)\s]+)\)/gu, " ");
}

function extractPathTokens(line: string): PathToken[] {
  return [...line.matchAll(/[^\s]+/gu)].map((match) => ({
    raw: match[0],
    start: match.index ?? 0,
  }));
}

function hasProhibitiveCueBefore(line: string, tokenStart: number): boolean {
  const context = line.slice(Math.max(0, tokenStart - 80), tokenStart).toLowerCase();

  return /\b(no|never|do not|avoid|must not|forbid|forbidden|without)\b/u.test(context);
}

function isBranchPatternReference(candidatePath: string, line: string): boolean {
  return (
    /^[A-Za-z0-9._-]+\/$/u.test(candidatePath) &&
    /\b(branch|branches|backport)\b/iu.test(line)
  );
}

function isEnvironmentRelativeReference(candidatePath: string, line: string): boolean {
  return (
    candidatePath.startsWith("../") &&
    /\b(sibling|cloned locally as|local clone|local checkout|workspace)\b/iu.test(line)
  );
}

function isMarkdownRouteCandidate(candidatePath: string): boolean {
  if (!candidatePath.startsWith("/")) {
    return false;
  }

  if (candidatePath.includes("://") || hasPlaceholderSyntax(candidatePath)) {
    return false;
  }

  const segments = splitPathSegments(candidatePath);

  return (
    segments.length >= 1 &&
    segments.every((segment) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(segment))
  );
}

function hasStrongLocalSignal(candidatePath: string): boolean {
  if (candidatePath === "" || candidatePath === "." || candidatePath === "..") {
    return false;
  }

  if (candidatePath === "~" || candidatePath.startsWith("~/")) {
    return false;
  }

  if (candidatePath.includes("://") || candidatePath.includes("#")) {
    return false;
  }

  if (candidatePath.startsWith("@")) {
    return false;
  }

  if (
    isEllipsisToken(candidatePath) ||
    isCommonAbbreviationToken(candidatePath) ||
    isRuntimeAdjectiveToken(candidatePath) ||
    hasPlaceholderSyntax(candidatePath) ||
    isLiteralExtensionToken(candidatePath) ||
    isConfigKeyToken(candidatePath) ||
    isPackageImportSpecifier(candidatePath) ||
    isVersionLikeToken(candidatePath)
  ) {
    return false;
  }

  if (KNOWN_ROOT_FILES.has(candidatePath)) {
    return true;
  }

  if (!candidatePath.includes("/")) {
    if (candidatePath.startsWith(".")) {
      return isAllowedBareDotfile(candidatePath);
    }

    return hasFileExtension(candidatePath);
  }

  const segments = splitPathSegments(candidatePath);
  const firstSegment = segments[0]?.toLowerCase() ?? "";

  if (
    !hasRelativePrefix(candidatePath) &&
    !candidatePath.endsWith("/") &&
    !hasGlob(candidatePath) &&
    !hasFileExtension(candidatePath) &&
    !hasDotSegment(candidatePath) &&
    !STRONG_CODE_ROOT_SEGMENTS.has(firstSegment) &&
    isWordSlashPhrase(candidatePath)
  ) {
    return false;
  }

  if (
    hasRelativePrefix(candidatePath) ||
    candidatePath.endsWith("/") ||
    hasGlob(candidatePath) ||
    hasFileExtension(candidatePath) ||
    hasDotSegment(candidatePath)
  ) {
    return true;
  }

  if (STRONG_CODE_ROOT_SEGMENTS.has(firstSegment)) {
    return segments.length >= 2;
  }

  if (WEAK_CODE_ROOT_SEGMENTS.has(firstSegment)) {
    return segments.length >= 3 && hasCodeLikeSegment(candidatePath);
  }

  return false;
}

function isExternalReferenceCandidate(candidatePath: string, line: string): boolean {
  if (
    hasRelativePrefix(candidatePath) ||
    candidatePath.endsWith("/") ||
    hasGlob(candidatePath) ||
    hasFileExtension(candidatePath) ||
    hasDotSegment(candidatePath)
  ) {
    return false;
  }

  const segments = splitPathSegments(candidatePath);
  const firstSegment = segments[0]?.toLowerCase() ?? "";
  const isExplicitLiteral = line.includes(`\`${candidatePath}\``);

  return (
    segments.length === 2 &&
    !STRONG_CODE_ROOT_SEGMENTS.has(firstSegment) &&
    segments.every((segment) => /^[a-z0-9][a-z0-9-]*$/u.test(segment)) &&
    isExplicitLiteral &&
    EXTERNAL_REFERENCE_CONTEXT.test(line)
  );
}

function hasHardRequirementCue(line: string): boolean {
  return /\b(must exist|required|requires|live in|lives in|stored in|stored under|add|create|update|edit|open|read|write)\b/iu.test(
    line,
  );
}

function isReferenceFormatExample(line: string): boolean {
  return (
    /\b(repo-root refs?|repository refs?|root-relative refs?|file refs?|path refs?|references?)\b.{0,48}\b(only|format|example)\b/iu.test(
      line,
    ) ||
    /\b(only|format|example)\b.{0,48}\b(repo-root refs?|repository refs?|root-relative refs?|file refs?|path refs?|references?)\b/iu.test(
      line,
    )
  );
}

function isCliOptionValue(line: string, tokenStart?: number): boolean {
  if (tokenStart === undefined) {
    return false;
  }

  const beforeToken = line.slice(0, tokenStart);

  return /(?:^|\s)--[A-Za-z0-9][A-Za-z0-9-]*[=\s]+$/u.test(beforeToken);
}

function isConfigValue(line: string, candidatePath: string): boolean {
  return new RegExp(
    `^\\s*[A-Za-z0-9_.-]+\\s*:\\s*["']?${candidatePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}["']?\\s*,?\\s*$`,
    "u",
  ).test(line);
}

function classifyReferenceKind(
  candidatePath: string,
  line: string,
  section?: string,
  options?: { tokenStart?: number; insideFencedCode?: boolean },
): ReferenceKind {
  if (options?.insideFencedCode) {
    return "env";
  }

  if (
    EXTERNAL_LOCAL_PATH_CONTEXT.test(line) &&
    !hasRelativePrefix(candidatePath) &&
    !candidatePath.startsWith("/")
  ) {
    return "external";
  }

  if (isExternalReferenceCandidate(candidatePath, line)) {
    return "external";
  }

  if (
    isGenericRuntimeFileReference(candidatePath, line) ||
    (!hasHardRequirementCue(line) &&
      (isRuntimeGeneratedArtifact(candidatePath, line) ||
        isSchemaPatternReference(candidatePath, line) ||
        isTreeDiagramDirectoryReference(candidatePath, line) ||
        isReferenceConfigExampleLine(line)))
  ) {
    return "env";
  }

  if (
    !hasHardRequirementCue(line) &&
    (isReferenceFormatExample(line) ||
      isDirectoryInventoryReference(candidatePath, line) ||
      (/\b(example|sample|for example|e\.g\.|placeholder)\b/iu.test(line) &&
        (isCliOptionValue(line, options?.tokenStart) ||
          isConfigValue(line, candidatePath))))
  ) {
    return "example";
  }

  return classifyReferenceContext(line, section);
}

export function extractFilePaths(content: string): FileReference[] {
  const references: FileReference[] = [];
  const lines = content.split(/\r?\n/u);
  let currentSection: string | undefined;
  let currentContextDirectory: string | undefined;
  let insideFencedCode = false;

  function getReferenceContextDirectory(candidatePath: string): string | undefined {
    if (candidatePath.includes("/") || currentContextDirectory === undefined) {
      return undefined;
    }

    return currentContextDirectory;
  }

  function updateContextDirectoryFromLine(lineReferences: FileReference[], line: string): void {
    if (
      !/^\s*(?:\*\*)?(?:Location|Directory|Folder|Path)(?:\*\*)?\s*:/iu.test(line)
    ) {
      return;
    }

    const contextReference = lineReferences.find((reference) => reference.path.includes("/"));

    if (!contextReference) {
      return;
    }

    currentContextDirectory =
      contextReference.target === "file"
        ? contextReference.path.split("/").slice(0, -1).join("/")
        : contextReference.path.replace(/\/+$/u, "");
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      return;
    }

    if (/^(```|~~~)/u.test(trimmedLine)) {
      insideFencedCode = !insideFencedCode;
      return;
    }

    if (/^#{1,6}\s+/u.test(trimmedLine)) {
      currentSection = trimmedLine.replace(/^#{1,6}\s+/u, "");
      currentContextDirectory = undefined;
      return;
    }

    const seenPaths = new Set<string>();
    const lineReferences: FileReference[] = [];
    const markdownTargets = extractMarkdownLinkTargets(line).map((target) =>
      normalizePathToken(target, { preserveLeadingSlash: true }),
    );
    const lineWithoutMarkdownLinks = stripMarkdownLinks(line);
    const tokens = extractPathTokens(lineWithoutMarkdownLinks);

    for (const markdownTarget of markdownTargets) {
      if (
        markdownTarget === "" ||
        (!hasStrongLocalSignal(markdownTarget) &&
          !isMarkdownRouteCandidate(markdownTarget) &&
          !isExternalReferenceCandidate(markdownTarget, trimmedLine)) ||
        seenPaths.has(markdownTarget)
      ) {
        continue;
      }

      seenPaths.add(markdownTarget);
      const reference: FileReference = {
        path: markdownTarget.replace(/^\.\//u, ""),
        rawPath: markdownTarget,
        line: index + 1,
        instructionText: trimmedLine,
        token: markdownTarget,
        kind: classifyReferenceKind(markdownTarget, trimmedLine, currentSection, {
          insideFencedCode,
        }),
        target: detectPathTargetKind(markdownTarget),
      };

      if (currentSection !== undefined) {
        reference.section = currentSection;
      }

      references.push(reference);
      lineReferences.push(reference);
    }

    for (const token of tokens) {
      const sanitizedToken = sanitizeToken(token.raw);
      const normalizedToken = normalizePathToken(
        stripLineNumberSuffix(sanitizedToken),
      );

      if (
        normalizedToken === "" ||
        isShellRecursiveGlob(normalizedToken) ||
        isBareConfigExample(normalizedToken, trimmedLine) ||
        isBranchPatternReference(normalizedToken, trimmedLine) ||
        isEnvironmentRelativeReference(normalizedToken, trimmedLine) ||
        isPackageExportSubpathReference(normalizedToken, trimmedLine) ||
        isNamingConventionExample(normalizedToken, trimmedLine) ||
        isLibraryOrFrameworkToken(normalizedToken, trimmedLine) ||
        isPlaceholderImportSnippet(normalizedToken, trimmedLine) ||
        isVariantQualifiedPathReference(normalizedToken, trimmedLine) ||
        (!hasStrongLocalSignal(normalizedToken) &&
          !isExternalReferenceCandidate(normalizedToken, trimmedLine))
      ) {
        continue;
      }

      if (hasProhibitiveCueBefore(lineWithoutMarkdownLinks, token.start)) {
        continue;
      }

      if (seenPaths.has(normalizedToken)) {
        continue;
      }

      seenPaths.add(normalizedToken);
      const reference: FileReference = {
        path: normalizedToken.replace(/^\.\//u, ""),
        rawPath: normalizedToken,
        line: index + 1,
        instructionText: trimmedLine,
        token: sanitizedToken,
        kind: classifyReferenceKind(
          normalizedToken,
          trimmedLine,
          currentSection,
          {
            tokenStart: token.start,
            insideFencedCode,
          },
        ),
        target: detectPathTargetKind(normalizedToken),
      };

      const contextDirectory = getReferenceContextDirectory(normalizedToken);

      if (contextDirectory !== undefined) {
        reference.contextDirectory = contextDirectory;
      }

      if (currentSection !== undefined) {
        reference.section = currentSection;
      }

      references.push(reference);
      lineReferences.push(reference);
    }

    updateContextDirectoryFromLine(lineReferences, trimmedLine);
  });

  return references;
}
