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
const EXTERNAL_REFERENCE_CONTEXT = /\b(another repo|external repo|owner repos?|publish repo|mirror build|see its|see their|route to|routes to|separate repo|cloned locally as)\b/iu;
const EXTERNAL_LOCAL_PATH_CONTEXT = /\bin (?:the )?(?:separate )?publish repo\b|\bin (?:the )?separate [^.,;:]+ repo\b/iu;
function sanitizeToken(token) {
    let value = token.trim();
    const wrapperPairs = [
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
function stripLineNumberSuffix(token) {
    const withExtensionMatch = /^(?<path>.+\.[A-Za-z0-9._-]{1,12}):\d+$/u.exec(token)?.groups?.path;
    if (withExtensionMatch) {
        return withExtensionMatch;
    }
    const slashPathMatch = /^(?<path>.+\/[^/]+):\d+$/u.exec(token)?.groups?.path;
    return slashPathMatch ?? token;
}
function normalizePathToken(token, options) {
    const normalized = token.replace(/\\/gu, "/");
    if (options?.preserveLeadingSlash) {
        return normalized;
    }
    return normalized.replace(/^\/+/u, "");
}
function splitPathSegments(candidatePath) {
    return candidatePath.split("/").filter((segment) => segment !== "");
}
function hasFileExtension(candidatePath) {
    const segments = splitPathSegments(candidatePath);
    const lastSegment = segments[segments.length - 1] ?? candidatePath;
    return /^[A-Za-z0-9._-]+\.[A-Za-z][A-Za-z0-9_-]{0,11}$/u.test(lastSegment);
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
function isWordLikeSegment(segment) {
    return /^[A-Za-z][A-Za-z-]*$/u.test(segment);
}
function isWordSlashPhrase(candidatePath) {
    const segments = splitPathSegments(candidatePath);
    return (segments.length >= 2 &&
        segments.every((segment) => isWordLikeSegment(segment)));
}
function hasPlaceholderSyntax(candidatePath) {
    return (/<[^>]*>/u.test(candidatePath) ||
        candidatePath.includes("<") ||
        candidatePath.includes(">") ||
        candidatePath.includes("{") ||
        candidatePath.includes("}"));
}
function isLiteralExtensionToken(candidatePath) {
    return /^\.[A-Za-z]{1,8}$/u.test(candidatePath);
}
function isEllipsisToken(candidatePath) {
    return /^\.{2,}$/u.test(candidatePath);
}
function isConfigKeyToken(candidatePath) {
    if (candidatePath.includes("/") || KNOWN_ROOT_FILES.has(candidatePath)) {
        return false;
    }
    const segments = candidatePath.split(".");
    return (segments.length >= 3 &&
        segments.every((segment) => /^[A-Za-z_$][A-Za-z0-9_$]*(?:\[\])?$/u.test(segment)));
}
function isAllowedBareDotfile(candidatePath) {
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
function isBareConfigExample(candidatePath, line) {
    if (candidatePath.includes("/") || KNOWN_ROOT_FILES.has(candidatePath)) {
        return false;
    }
    if (!/^[A-Za-z0-9_-]+\.(json|ya?ml|toml)$/iu.test(candidatePath)) {
        return false;
    }
    return /\b(configure|configuration|config|settings|defaults?|env|environment)\b/iu.test(line);
}
function isTemplateVersionToken(candidatePath) {
    return /^v?[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9-]*)+(?:-[A-Za-z0-9.-]+)?$/u.test(candidatePath);
}
function isNumericVersionToken(candidatePath) {
    return /^\d+(?:\.\d+|\.x)+(?:-[A-Za-z0-9.-]+)?$/iu.test(candidatePath);
}
function isModelVersionToken(candidatePath) {
    return /^[A-Za-z][A-Za-z0-9-]*-\d+(?:\.\d+|\.x)+(?:-[A-Za-z0-9.-]+)?$/iu.test(candidatePath);
}
function isVersionLikeToken(candidatePath) {
    return (isTemplateVersionToken(candidatePath) ||
        isNumericVersionToken(candidatePath) ||
        isModelVersionToken(candidatePath));
}
function isPackageImportSpecifier(candidatePath) {
    if (hasRelativePrefix(candidatePath) ||
        candidatePath.startsWith("/") ||
        candidatePath.startsWith(".") ||
        hasFileExtension(candidatePath)) {
        return false;
    }
    const segments = splitPathSegments(candidatePath);
    const firstSegment = segments[0]?.toLowerCase() ?? "";
    return (segments.length >= 2 &&
        segments.length <= 3 &&
        !STRONG_CODE_ROOT_SEGMENTS.has(firstSegment) &&
        !WEAK_CODE_ROOT_SEGMENTS.has(firstSegment) &&
        segments.every((segment, index) => index === segments.length - 1 && segment === "*"
            ? true
            : /^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(segment)));
}
function extractMarkdownLinkTargets(line) {
    const matches = line.matchAll(/\[[^\]]+\]\((?<target>[^)\s]+)\)/gu);
    const targets = [];
    for (const match of matches) {
        const target = match.groups?.target;
        if (!target) {
            continue;
        }
        targets.push(target.replace(/[?#].*$/u, ""));
    }
    return targets;
}
function stripMarkdownLinks(line) {
    return line.replace(/\[[^\]]+\]\(([^)\s]+)\)/gu, " ");
}
function extractPathTokens(line) {
    return [...line.matchAll(/[^\s]+/gu)].map((match) => ({
        raw: match[0],
        start: match.index ?? 0,
    }));
}
function hasProhibitiveCueBefore(line, tokenStart) {
    const context = line.slice(Math.max(0, tokenStart - 80), tokenStart).toLowerCase();
    return /\b(no|never|do not|avoid|must not|forbid|forbidden|without)\b/u.test(context);
}
function isBranchPatternReference(candidatePath, line) {
    return (/^[A-Za-z0-9._-]+\/$/u.test(candidatePath) &&
        /\b(branch|branches|backport)\b/iu.test(line));
}
function isEnvironmentRelativeReference(candidatePath, line) {
    return (candidatePath.startsWith("../") &&
        /\b(sibling|cloned locally as|local clone|local checkout|workspace)\b/iu.test(line));
}
function isMarkdownRouteCandidate(candidatePath) {
    if (!candidatePath.startsWith("/")) {
        return false;
    }
    if (candidatePath.includes("://") || hasPlaceholderSyntax(candidatePath)) {
        return false;
    }
    const segments = splitPathSegments(candidatePath);
    return (segments.length >= 1 &&
        segments.every((segment) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(segment)));
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
    if (isEllipsisToken(candidatePath) ||
        hasPlaceholderSyntax(candidatePath) ||
        isLiteralExtensionToken(candidatePath) ||
        isConfigKeyToken(candidatePath) ||
        isPackageImportSpecifier(candidatePath) ||
        isVersionLikeToken(candidatePath)) {
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
        return segments.length >= 2;
    }
    if (WEAK_CODE_ROOT_SEGMENTS.has(firstSegment)) {
        return segments.length >= 3 && hasCodeLikeSegment(candidatePath);
    }
    return false;
}
function isExternalReferenceCandidate(candidatePath, line) {
    if (hasRelativePrefix(candidatePath) ||
        candidatePath.endsWith("/") ||
        hasGlob(candidatePath) ||
        hasFileExtension(candidatePath) ||
        hasDotSegment(candidatePath)) {
        return false;
    }
    const segments = splitPathSegments(candidatePath);
    const firstSegment = segments[0]?.toLowerCase() ?? "";
    const isExplicitLiteral = line.includes(`\`${candidatePath}\``);
    if (firstSegment === "openclaw" &&
        /\b(import|imports|importing|from)\b/iu.test(line)) {
        return false;
    }
    return (segments.length === 2 &&
        !STRONG_CODE_ROOT_SEGMENTS.has(firstSegment) &&
        segments.every((segment) => /^[a-z0-9][a-z0-9-]*$/u.test(segment)) &&
        (firstSegment === "openclaw" ||
            (isExplicitLiteral && EXTERNAL_REFERENCE_CONTEXT.test(line))));
}
function classifyReferenceKind(candidatePath, line, section) {
    if (EXTERNAL_LOCAL_PATH_CONTEXT.test(line) &&
        !hasRelativePrefix(candidatePath) &&
        !candidatePath.startsWith("/")) {
        return "external";
    }
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
        const markdownTargets = extractMarkdownLinkTargets(line).map((target) => normalizePathToken(target, { preserveLeadingSlash: true }));
        const lineWithoutMarkdownLinks = stripMarkdownLinks(line);
        const tokens = extractPathTokens(lineWithoutMarkdownLinks);
        for (const markdownTarget of markdownTargets) {
            if (markdownTarget === "" ||
                (!hasStrongLocalSignal(markdownTarget) &&
                    !isMarkdownRouteCandidate(markdownTarget) &&
                    !isExternalReferenceCandidate(markdownTarget, trimmedLine)) ||
                seenPaths.has(markdownTarget)) {
                continue;
            }
            seenPaths.add(markdownTarget);
            const reference = {
                path: markdownTarget.replace(/^\.\//u, ""),
                rawPath: markdownTarget,
                line: index + 1,
                instructionText: trimmedLine,
                token: markdownTarget,
                kind: classifyReferenceKind(markdownTarget, trimmedLine, currentSection),
                target: detectPathTargetKind(markdownTarget),
            };
            if (currentSection !== undefined) {
                reference.section = currentSection;
            }
            references.push(reference);
        }
        for (const token of tokens) {
            const sanitizedToken = sanitizeToken(token.raw);
            const normalizedToken = normalizePathToken(stripLineNumberSuffix(sanitizedToken));
            if (normalizedToken === "" ||
                isBareConfigExample(normalizedToken, trimmedLine) ||
                isBranchPatternReference(normalizedToken, trimmedLine) ||
                isEnvironmentRelativeReference(normalizedToken, trimmedLine) ||
                (!hasStrongLocalSignal(normalizedToken) &&
                    !isExternalReferenceCandidate(normalizedToken, trimmedLine))) {
                continue;
            }
            if (hasProhibitiveCueBefore(lineWithoutMarkdownLinks, token.start)) {
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