import path from "node:path";
import {
  isPathIgnoredByRules,
  isTrackedPath,
} from "../utils/gitIgnore.ts";
import { matchesPathPattern } from "../utils/pathPatterns.ts";
import { findClosestPaths } from "../utils/pathSimilarity.ts";
import type {
  AgentLintIssue,
  FileReference,
  ReferenceKind,
  ScanContext,
} from "../types.ts";

function normalizeRepoPath(candidatePath: string): string {
  const normalized = path.posix.normalize(candidatePath.replace(/\\/gu, "/"));
  return normalized.replace(/^\/+/u, "").replace(/^\.\//u, "").replace(/\/+$/u, "");
}

function getPackageRootAnchor(sourceFile: string): string | null {
  const segments = sourceFile.split("/");
  const githubIndex = segments.indexOf(".github");

  if (githubIndex > 0) {
    return segments.slice(0, githubIndex).join("/");
  }

  if (
    segments.length >= 2 &&
    ["apps", "extensions", "packages"].includes(segments[0] ?? "")
  ) {
    return segments.slice(0, 2).join("/");
  }

  return null;
}

function addMonorepoContainerCandidates(candidates: Set<string>, rawPath: string): void {
  const trimmedPath = rawPath.replace(/^\.\/+/u, "").replace(/\/+$/u, "");

  if (trimmedPath === "" || trimmedPath.includes("/")) {
    return;
  }

  for (const container of ["apps", "extensions", "packages"]) {
    candidates.add(normalizeRepoPath(path.posix.join(container, trimmedPath)));
  }
}

function resolveReferenceCandidates(
  sourceFile: string,
  reference: FileReference,
): string[] {
  const instructionDirectory = path.posix.dirname(sourceFile);
  const rawPath = reference.rawPath;
  const packageRootAnchor = getPackageRootAnchor(sourceFile);
  const candidates = new Set<string>();

  candidates.add(normalizeRepoPath(reference.path));
  addMonorepoContainerCandidates(candidates, rawPath);

  if (
    rawPath.startsWith("/") &&
    sourceFile.startsWith("docs/") &&
    !rawPath.includes("*") &&
    !rawPath.includes("?")
  ) {
    const docsRoute = normalizeRepoPath(rawPath);

    candidates.add(normalizeRepoPath(path.posix.join("docs", `${docsRoute}.md`)));
    candidates.add(normalizeRepoPath(path.posix.join("docs", `${docsRoute}.mdx`)));
    candidates.add(normalizeRepoPath(path.posix.join("docs", docsRoute, "index.md")));
    candidates.add(normalizeRepoPath(path.posix.join("docs", docsRoute, "index.mdx")));
  }

  if (rawPath.startsWith("./") || rawPath.startsWith("../")) {
    candidates.add(
      normalizeRepoPath(path.posix.join(instructionDirectory, rawPath)),
    );
  } else if (instructionDirectory !== "." && instructionDirectory !== "") {
    if (packageRootAnchor) {
      candidates.add(normalizeRepoPath(path.posix.join(packageRootAnchor, rawPath)));
    }

    candidates.add(
      normalizeRepoPath(path.posix.join(instructionDirectory, rawPath)),
    );
  }

  return [...candidates].filter((candidate) => candidate !== "");
}

function referenceExists(
  candidates: string[],
  reference: FileReference,
  context: ScanContext,
): boolean {
  const collection =
    reference.target === "file"
      ? context.repoFiles
      : reference.target === "dir"
        ? context.repoDirectories
        : [...context.repoFiles, ...context.repoDirectories];

  return candidates.some((candidate) => {
    if (candidate.includes("*") || candidate.includes("?")) {
      return collection.some((entry) => matchesPathPattern(entry, candidate));
    }

    if (
      reference.target === "file" &&
      !candidate.includes("/") &&
      context.repoFiles.some((entry) => path.posix.basename(entry) === candidate)
    ) {
      return true;
    }

    return collection.includes(candidate);
  });
}

function hasSafeIgnoredCandidate(
  candidates: string[],
  reference: FileReference,
  context: ScanContext,
): boolean {
  return candidates.some((candidate) => {
    if (!isPathIgnoredByRules(candidate, reference.target, context.gitIgnoreRules)) {
      return false;
    }

    return !isTrackedPath(candidate, reference.target, context.trackedPaths);
  });
}

function hasEquivalentIgnoredArtifactPath(context: ScanContext): boolean {
  return context.gitIgnoreRules.some((rule) => {
    if (rule.pattern.startsWith("!")) {
      return false;
    }

    const normalizedPattern = rule.pattern.replace(/^\/+/u, "");

    if (!/(^|\/)(\.codex|tmp|temp|artifacts?|reports?|cache)(\/|$)/iu.test(normalizedPattern)) {
      return false;
    }

    const target = normalizedPattern.endsWith("/") ? "dir" : "path";
    const candidatePath = path.posix.join(
      rule.basePath,
      normalizedPattern.replace(/\/+$/u, ""),
    );

    return !isTrackedPath(
      candidatePath,
      target,
      context.trackedPaths,
    );
  });
}

function groupReferencesByLine(
  references: FileReference[],
): Map<string, FileReference[]> {
  const groups = new Map<string, FileReference[]>();

  for (const reference of references) {
    const key = `${reference.line}:${reference.kind}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(reference);
    groups.set(key, bucket);
  }

  return groups;
}

function buildInfoMessage(kind: ReferenceKind): string {
  switch (kind) {
    case "example":
      return "Example path reference";
    case "policy":
      return "Path policy";
    case "env":
      return "Environment path assumption";
    case "external":
      return "External repository reference";
    default:
      return "Broken file reference";
  }
}

function buildInfoRepoFact(kind: ReferenceKind): string {
  switch (kind) {
    case "example":
      return "The example paths are not currently present and no equivalent safe path was detected.";
    case "policy":
      return "The policy expects a safe path, but no matching existing or ignored location was detected.";
    case "env":
      return "The referenced environment path is not currently visible in the repository.";
    case "external":
      return "The instruction points to another repository or external workspace, which cannot be validated against this repository.";
    default:
      return "The referenced path does not exist in the repository.";
  }
}

function buildInfoSuggestion(kind: ReferenceKind): string {
  switch (kind) {
    case "example":
      return "If this example is intentional, keep it. Otherwise point the instruction to a concrete existing path.";
    case "policy":
      return "Add or document one concrete allowed path, or make sure an ignored target directory is configured.";
    case "env":
      return "Document when this path is created or replace it with a concrete repository path.";
    case "external":
      return "Keep the external reference if intentional, or replace it with a local repository path when local repository proof is required.";
    default:
      return "Update the instruction to point to a concrete repository path.";
  }
}

function shouldEmitInfoIssue(reference: FileReference): boolean {
  if (reference.kind === "env") {
    return false;
  }

  if (reference.kind !== "external") {
    return true;
  }

  return (
    reference.path.startsWith("openclaw/") ||
    /\b(another repo|external repo|owner repos?|publish repo|mirror build|see its|see their|route to|routes to|separate repo|cloned locally as)\b/iu.test(
      reference.instructionText,
    )
  );
}

function buildSuggestion(referencePath: string, suggestions: string[]): string {
  if (suggestions.length === 0) {
    return `Update the instruction or add "${referencePath}" to the repository.`;
  }

  return `Use ${suggestions[0]} or update the instruction.`;
}

export function brokenFileReferences(context: ScanContext): AgentLintIssue[] {
  const issues: AgentLintIssue[] = [];

  for (const instructionFile of context.instructionFiles) {
    const groups = groupReferencesByLine(instructionFile.fileReferences);

    for (const references of groups.values()) {
      const [firstReference] = references;

      if (!firstReference) {
        continue;
      }

      if (firstReference.kind !== "hard") {
        if (!shouldEmitInfoIssue(firstReference)) {
          continue;
        }

        const hasSatisfiedReference = references.some((reference) => {
          if (reference.kind === "external") {
            return false;
          }

          const candidates = resolveReferenceCandidates(
            instructionFile.path,
            reference,
          );

          return (
            referenceExists(candidates, reference, context) ||
            hasSafeIgnoredCandidate(candidates, reference, context) ||
            (reference.kind !== "env" && hasEquivalentIgnoredArtifactPath(context))
          );
        });

        if (hasSatisfiedReference) {
          continue;
        }

        issues.push({
          id: `broken-file-reference:${instructionFile.path}:${firstReference.line}:${firstReference.kind}`,
          rule: "brokenFileReferences",
          severity: "info",
          sourceFile: instructionFile.path,
          line: firstReference.line,
          message: buildInfoMessage(firstReference.kind),
          referenceKind: firstReference.kind,
          evidence: {
            instructionText: firstReference.instructionText,
            repoFact: buildInfoRepoFact(firstReference.kind),
          },
          suggestion: buildInfoSuggestion(firstReference.kind),
          suggestions: references.map((reference) => reference.path),
        });
        continue;
      }

      for (const reference of references) {
        const candidates = resolveReferenceCandidates(instructionFile.path, reference);

        if (
          referenceExists(candidates, reference, context) ||
          hasSafeIgnoredCandidate(candidates, reference, context)
        ) {
          continue;
        }

        const suggestions = findClosestPaths(
          candidates[0] ?? reference.path,
          context.repoFiles,
          3,
        );
        const severity = reference.target === "dir" ? "warning" : "error";

        issues.push({
          id: `broken-file-reference:${instructionFile.path}:${reference.line}:${reference.path}`,
          rule: "brokenFileReferences",
          severity,
          sourceFile: instructionFile.path,
          line: reference.line,
          message:
            reference.target === "dir"
              ? "Missing directory reference"
              : "Broken file reference",
          referenceKind: reference.kind,
          evidence: {
            instructionText: reference.instructionText,
            repoFact: `"${reference.path}" does not resolve to an existing ${reference.target === "dir" ? "directory" : "file"} from ${instructionFile.path}.`,
          },
          suggestion: buildSuggestion(reference.path, suggestions),
          suggestions,
        });
      }
    }
  }

  return issues;
}
