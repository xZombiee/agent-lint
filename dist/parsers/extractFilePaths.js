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
function sanitizeToken(token) {
    return token
        .trim()
        .replace(/^[`"'([{<]+/u, "")
        .replace(/[`"')\]}>.,;:!?]+$/u, "");
}
function isLikelyFilePath(token) {
    if (token === "" || token === "." || token === "..") {
        return false;
    }
    if (token.includes("://") || token.includes("*") || token.includes("#")) {
        return false;
    }
    if (token.startsWith("@")) {
        return false;
    }
    if (token.includes("/")) {
        return true;
    }
    if (KNOWN_ROOT_FILES.has(token)) {
        return true;
    }
    if (token.startsWith(".")) {
        return token.length > 1;
    }
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9._-]{1,8}$/u.test(token);
}
function normalizePathToken(token) {
    return token.replace(/\\/gu, "/").replace(/^\/+/u, "");
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
        const kind = classifyReferenceContext(trimmedLine, currentSection);
        for (const token of tokens) {
            const sanitizedToken = sanitizeToken(token);
            if (!isLikelyFilePath(sanitizedToken)) {
                continue;
            }
            const normalizedPath = normalizePathToken(sanitizedToken);
            if (normalizedPath === "" || seenPaths.has(normalizedPath)) {
                continue;
            }
            seenPaths.add(normalizedPath);
            const reference = {
                path: normalizedPath.replace(/^\.\//u, ""),
                rawPath: normalizedPath,
                line: index + 1,
                instructionText: trimmedLine,
                token: sanitizedToken,
                kind,
                target: detectPathTargetKind(normalizedPath),
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