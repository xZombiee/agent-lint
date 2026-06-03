function normalizeContextValue(value) {
    return value.toLowerCase();
}
export function classifyReferenceContext(line, section) {
    const context = normalizeContextValue(section ? `${section}\n${line}` : line);
    if (/\b(git-ignored|ignored|temporary|artifacts?|reports?|generated artifacts?|scratch|cache)\b/u.test(context) ||
        /\b(store|write|place|keep)\b.{0,40}\b(in|under|inside)\b/u.test(context) ||
        /\b(do not create|avoid writing|suffix)\b/u.test(context)) {
        return "policy";
    }
    if (/\b(such as|for example|e\.g\.|for instance|or another|one of)\b/u.test(context)) {
        return "example";
    }
    if (/\b(runtime|ci|machine-specific|symlink|generated at runtime|created during|depends on environment|local environment|environment variables?|env vars?|config option|config shape|local-only|git\/info\/exclude|global storage|event stream|persistence|persisted|generated files?)\b/u.test(context)) {
        return "env";
    }
    return "hard";
}
export function detectPathTargetKind(rawPath) {
    if (rawPath.endsWith("/")) {
        return "dir";
    }
    if (/\.[A-Za-z0-9._-]{1,12}$/u.test(rawPath)) {
        return "file";
    }
    return "path";
}
//# sourceMappingURL=referenceContext.js.map