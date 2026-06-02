import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import type { GitIgnoreRule, PathTargetKind } from "../types.ts";
import { matchesPathPattern } from "./pathPatterns.ts";
import { pathExists } from "./pathExists.ts";

const execFileAsync = promisify(execFile);

function normalizePath(value: string): string {
  const normalized = value.replace(/\\/gu, "/").replace(/^\/+/u, "");
  return normalized === "." ? "" : normalized;
}

function normalizePattern(value: string): string {
  return value.replace(/\\/gu, "/").trim();
}

function parseIgnoreRules(
  content: string,
  source: string,
  basePath: string,
): GitIgnoreRule[] {
  return content
    .split(/\r?\n/u)
    .map((line) => normalizePattern(line))
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((pattern) => ({
      pattern,
      basePath,
      source,
    }));
}

function normalizeRulePattern(pattern: string): {
  isNegated: boolean;
  isDirectory: boolean;
  body: string;
  anchored: boolean;
} {
  const isNegated = pattern.startsWith("!");
  const candidate = isNegated ? pattern.slice(1) : pattern;
  const anchored = candidate.startsWith("/");
  const body = normalizePath(anchored ? candidate.slice(1) : candidate);
  const isDirectory = body.endsWith("/");

  return {
    isNegated,
    isDirectory,
    body: isDirectory ? body.slice(0, -1) : body,
    anchored,
  };
}

function stripBasePath(candidatePath: string, basePath: string): string | null {
  const normalizedCandidate = normalizePath(candidatePath);
  const normalizedBase = normalizePath(basePath);

  if (normalizedBase === "") {
    return normalizedCandidate;
  }

  if (normalizedCandidate === normalizedBase) {
    return "";
  }

  if (!normalizedCandidate.startsWith(`${normalizedBase}/`)) {
    return null;
  }

  return normalizedCandidate.slice(normalizedBase.length + 1);
}

function matchesSlashlessPattern(relativePath: string, pattern: string): boolean {
  const segments = relativePath.split("/").filter(Boolean);

  if (segments.includes(pattern)) {
    return true;
  }

  return segments.some((segment) => matchesPathPattern(segment, pattern));
}

function matchesRule(
  candidatePath: string,
  target: PathTargetKind,
  rule: GitIgnoreRule,
): boolean {
  const relativePath = stripBasePath(candidatePath, rule.basePath);

  if (relativePath === null) {
    return false;
  }

  const normalizedRelativePath = normalizePath(relativePath);
  const normalizedCandidateDirectory = normalizedRelativePath.endsWith("/")
    ? normalizedRelativePath
    : `${normalizedRelativePath}/`;
  const { body, isDirectory, anchored } = normalizeRulePattern(rule.pattern);

  if (body === "") {
    return false;
  }

  if (!anchored && !body.includes("/")) {
    if (isDirectory) {
      return (
        target !== "file" &&
        (normalizedRelativePath === body ||
          normalizedCandidateDirectory.startsWith(`${body}/`) ||
          normalizedRelativePath.split("/").includes(body))
      );
    }

    return matchesSlashlessPattern(normalizedRelativePath, body);
  }

  if (isDirectory) {
    return (
      normalizedRelativePath === body ||
      normalizedCandidateDirectory.startsWith(`${body}/`) ||
      matchesPathPattern(normalizedRelativePath, body) ||
      matchesPathPattern(normalizedCandidateDirectory, body)
    );
  }

  return (
    normalizedRelativePath === body ||
    normalizedRelativePath.startsWith(`${body}/`) ||
    matchesPathPattern(normalizedRelativePath, body)
  );
}

export function isPathIgnoredByRules(
  candidatePath: string,
  target: PathTargetKind,
  rules: GitIgnoreRule[],
): boolean {
  let ignored = false;

  for (const rule of rules) {
    if (!matchesRule(candidatePath, target, rule)) {
      continue;
    }

    ignored = !normalizeRulePattern(rule.pattern).isNegated;
  }

  return ignored;
}

export function isTrackedPath(
  candidatePath: string,
  target: PathTargetKind,
  trackedPaths: string[],
): boolean {
  const normalizedCandidate = normalizePath(candidatePath);

  if (target === "dir") {
    return trackedPaths.some(
      (trackedPath) =>
        trackedPath === normalizedCandidate ||
        trackedPath.startsWith(`${normalizedCandidate}/`),
    );
  }

  return trackedPaths.includes(normalizedCandidate);
}

async function resolveGlobalIgnoreFile(projectRoot: string): Promise<string | null> {
  const gitMarkerPath = path.join(projectRoot, ".git");

  if (!(await pathExists(gitMarkerPath))) {
    return null;
  }

  try {
    const { stdout } = await execFileAsync("git", ["config", "--path", "core.excludesFile"], {
      cwd: projectRoot,
    });
    const resolvedPath = stdout.trim();

    return resolvedPath === "" ? null : resolvedPath;
  } catch {
    return null;
  }
}

async function readIgnoreFileRules(
  filePath: string,
  source: string,
  basePath: string,
): Promise<GitIgnoreRule[]> {
  if (!(await pathExists(filePath))) {
    return [];
  }

  const content = await readFile(filePath, "utf8");
  return parseIgnoreRules(content, source, basePath);
}

export async function readGitIgnoreRules(
  projectRoot: string,
  repoFiles: string[],
): Promise<GitIgnoreRule[]> {
  const rules: GitIgnoreRule[] = [];
  const globalIgnoreFile = await resolveGlobalIgnoreFile(projectRoot);

  if (globalIgnoreFile) {
    rules.push(...(await readIgnoreFileRules(globalIgnoreFile, "global", "")));
  }

  rules.push(
    ...(await readIgnoreFileRules(
      path.join(projectRoot, ".git", "info", "exclude"),
      ".git/info/exclude",
      "",
    )),
  );

  const ignoreFiles = repoFiles
    .filter((repoFile) => path.posix.basename(repoFile).toLowerCase() === ".gitignore")
    .sort((left, right) => {
      const depthDifference = left.split("/").length - right.split("/").length;
      return depthDifference !== 0 ? depthDifference : left.localeCompare(right);
    });

  for (const ignoreFile of ignoreFiles) {
    const ignoreFilePath = path.join(projectRoot, ignoreFile);
    const basePath = path.posix.dirname(ignoreFile) === "." ? "" : path.posix.dirname(ignoreFile);
    rules.push(...(await readIgnoreFileRules(ignoreFilePath, ignoreFile, basePath)));
  }

  return rules;
}

export async function listTrackedPaths(projectRoot: string): Promise<string[]> {
  const gitMarkerPath = path.join(projectRoot, ".git");

  if (!(await pathExists(gitMarkerPath))) {
    return [];
  }

  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    });

    return stdout
      .split("\0")
      .map((entry) => normalizePath(entry))
      .filter(Boolean);
  } catch {
    return [];
  }
}
