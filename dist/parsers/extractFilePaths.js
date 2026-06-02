import { classifyReferenceContext, detectPathTargetKind, } from "../utils/referenceContext.js";
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
    "app",
    "apps",
    "assets",
    "bin",
    "cmd",
    "examples",
    "extensions",
    "fixtures",
    "internal",
    "lib",
    "package",
    "packages",
    "public",
    "scripts",
    "src",
    "test",
    "tests",
    "ui",
]);
const EXTERNAL_REFERENCE_CONTEXT = /\b(another repo|external repo|owner repos?|publish repo|mirror build|see its|see their|route to|routes to|lives? in|owned|host)\b/iu;
function sanitizeToken(token) {
    return token
        .trim()
        .replace(/^[`"'([{<]+/u, "")
        .replace(/[`"')\]}>.,;:!?]+$/u, "");
}
function stripLineNumberSuffix(token) {
    const withExtensionMatch = /^(?<path>.+\.[A-Za-z0-9._-]{1,12}):\d+$/u.exec(token)?.groups?.path;
    if (withExtensionMatch) {
        return withExtensionMatch;
    }
    const slashPathMatch = /^(?<path>.+\/[^/]+):\d+$/u.exec(token)?.groups?.path;
    return slashPathMatch ?? token;
}
function normalizePathToken(token) {
    return token.replace(/\\/gu, "/").replace(/^\/+/u, "");
}
function splitPathSegments(candidatePath) {
    return candidatePath.split("/").filter((segment) => segment !== "");
}
function hasFileExtension(candidatePath) {
    const segments = splitPathSegments(candidatePath);
    const lastSegment = segments[segments.length - 1] ?? candidatePath;
    return /^[A-Za-z0-9._-]+\.[A-Za-z0-9._-]{1,12}$/u.test(lastSegment);
}
function hasGlob(candidatePath) {
    return /[*?]/u.test(candidatePath);
}
function hasRelativePrefix(candidatePath) {
    return candidatePath.startsWith("./") || candidatePath.startsWith("../");
}
function hasDotSegment(candidatePath) {
    return splitPathSegments(candidatePath).some((segment) => segment.startsWith("."));
}
function hasCodeLikeSegment(candidatePath) {
    return splitPathSegments(candidatePath).some((segment) => /[_-]|\d/u.test(segment));
}
function isWordSlashPhrase(candidatePath) {
    const segments = splitPathSegments(candidatePath);
    return (segments.length >= 2 &&
        segments.every((segment) => /^[A-Za-z][A-Za-z-]*$/u.test(segment)));
}
function hasStrongLocalSignal(candidatePath) {
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
    if (KNOWN_ROOT_FILES.has(candidatePath)) {
        return true;
    }
    if (!candidatePath.includes("/")) {
        if (candidatePath.startsWith(".")) {
            return candidatePath.length > 1;
        }
        return hasFileExtension(candidatePath);
    }
    const segments = splitPathSegments(candidatePath);
    const firstSegment = segments[0]?.toLowerCase() ?? "";
    if (!hasRelativePrefix(candidatePath) &&
        !candidatePath.endsWith("/") &&
        !hasGlob(candidatePath) &&
        !hasFileExtension(candidatePath) &&
        !hasDotSegment(candidatePath) &&
        !STRONG_CODE_ROOT_SEGMENTS.has(firstSegment) &&
        isWordSlashPhrase(candidatePath)) {
        return false;
    }
    if (hasRelativePrefix(candidatePath) ||
        candidatePath.endsWith("/") ||
        hasGlob(candidatePath) ||
        hasFileExtension(candidatePath) ||
        hasDotSegment(candidatePath)) {
        return true;
    }
    if (STRONG_CODE_ROOT_SEGMENTS.has(firstSegment)) {
        return true;
    }
    return hasCodeLikeSegment(candidatePath);
}
function isExternalReferenceCandidate(candidatePath, line) {
    if (!EXTERNAL_REFERENCE_CONTEXT.test(line)) {
        return false;
    }
    if (hasRelativePrefix(candidatePath) ||
        candidatePath.endsWith("/") ||
        hasGlob(candidatePath) ||
        hasFileExtension(candidatePath) ||
        hasDotSegment(candidatePath)) {
        return false;
    }
    const segments = splitPathSegments(candidatePath);
    const firstSegment = segments[0]?.toLowerCase() ?? "";
    return (segments.length === 2 &&
        !STRONG_CODE_ROOT_SEGMENTS.has(firstSegment) &&
        segments.every((segment) => /^[a-z0-9][a-z0-9-]*$/u.test(segment)));
}
function classifyReferenceKind(candidatePath, line, section) {
    if (isExternalReferenceCandidate(candidatePath, line)) {
        return "external";
    }
    return classifyReferenceContext(line, section);
}
export function extractFilePaths(content) {
    const references = [];
    const lines = content.split(/\r?\n/u);
    let currentSection;
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine === "") {
            return;
        }
        if (/^#{1,6}\s+/u.test(trimmedLine)) {
            currentSection = trimmedLine.replace(/^#{1,6}\s+/u, "");
            return;
        }
        const seenPaths = new Set();
        const tokens = line.match(/[^\s]+/gu) ?? [];
        for (const token of tokens) {
            const sanitizedToken = sanitizeToken(token);
            const normalizedToken = normalizePathToken(stripLineNumberSuffix(sanitizedToken));
            if (normalizedToken === "" ||
                (!hasStrongLocalSignal(normalizedToken) &&
                    !isExternalReferenceCandidate(normalizedToken, trimmedLine))) {
                continue;
            }
            if (seenPaths.has(normalizedToken)) {
                continue;
            }
            seenPaths.add(normalizedToken);
            const reference = {
                path: normalizedToken.replace(/^\.\//u, ""),
                rawPath: normalizedToken,
                line: index + 1,
                instructionText: trimmedLine,
                token: sanitizedToken,
                kind: classifyReferenceKind(normalizedToken, trimmedLine, currentSection),
                target: detectPathTargetKind(normalizedToken),
            };
            if (currentSection !== undefined) {
                reference.section = currentSection;
            }
            references.push(reference);
        }
    });
    return references;
}
//# sourceMappingURL=extractFilePaths.js.map