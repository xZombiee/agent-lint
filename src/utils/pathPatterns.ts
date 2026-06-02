function normalizePathSegment(value: string): string {
  return value.replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/+$/u, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.*]/gu, "\\$&");
}

export function matchesPathPattern(candidatePath: string, pattern: string): boolean {
  const normalizedPath = normalizePathSegment(candidatePath);
  const normalizedPattern = normalizePathSegment(pattern);

  if (normalizedPattern === "") {
    return false;
  }

  if (!normalizedPattern.includes("*") && !normalizedPattern.includes("?")) {
    return normalizedPath === normalizedPattern;
  }

  const placeholder = "__DOUBLE_STAR__";
  const patternSource = escapeRegExp(normalizedPattern)
    .replace(/\\\*\\\*\//gu, "(?:.*/)?")
    .replace(/\\\*\\\*/gu, placeholder)
    .replace(/\\\*/gu, "[^/]*")
    .replace(/\\\?/gu, "[^/]")
    .replace(new RegExp(placeholder, "gu"), ".*");

  return new RegExp(`^${patternSource}$`, "u").test(normalizedPath);
}

export function shouldIgnorePath(candidatePath: string, ignorePatterns: string[]): boolean {
  const normalizedPath = normalizePathSegment(candidatePath);

  return ignorePatterns.some((pattern) => {
    const normalizedPattern = normalizePathSegment(pattern);

    if (normalizedPattern === "") {
      return false;
    }

    if (normalizedPattern.includes("*") || normalizedPattern.includes("?")) {
      return matchesPathPattern(normalizedPath, normalizedPattern);
    }

    if (normalizedPattern.includes("/")) {
      return (
        normalizedPath === normalizedPattern ||
        normalizedPath.startsWith(`${normalizedPattern}/`)
      );
    }

    const segments = normalizedPath.split("/");
    return segments.includes(normalizedPattern);
  });
}
