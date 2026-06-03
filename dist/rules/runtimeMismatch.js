function extractMajorVersion(value) {
    return /v?(?<major>\d+)/iu.exec(value.replace(/^[<>=~^\s]+/u, ""))?.groups?.major ?? null;
}
function formatRuntimeFacts(facts) {
    return facts.map((fact) => `${fact.source} ${fact.version}`).join(", ");
}
function hasMatchingRuntimeMajor(mention, facts) {
    const mentionedMajor = extractMajorVersion(mention.version);
    if (!mentionedMajor) {
        return true;
    }
    return facts.some((fact) => extractMajorVersion(fact.version) === mentionedMajor);
}
export function runtimeMismatch(context) {
    const issues = [];
    for (const instructionFile of context.instructionFiles) {
        for (const mention of instructionFile.runtimeMentions) {
            const facts = context.repoFacts.runtimes[mention.runtime] ?? [];
            if (facts.length === 0 || hasMatchingRuntimeMajor(mention, facts)) {
                continue;
            }
            issues.push({
                id: `runtime-mismatch:${instructionFile.path}:${mention.line}:${mention.runtime}`,
                rule: "runtimeMismatch",
                severity: "warning",
                sourceFile: instructionFile.path,
                line: mention.line,
                message: "Runtime version mismatch",
                evidence: {
                    instructionText: mention.instructionText,
                    repoFact: `Repository runtime metadata says ${formatRuntimeFacts(facts)}, but the instruction mentions ${mention.runtime} ${mention.version}.`,
                },
                suggestion: `Update the instruction to match the repository ${mention.runtime} version metadata, or update the runtime metadata if the instruction is authoritative.`,
                suggestions: facts.map((fact) => fact.version),
            });
        }
    }
    return issues;
}
//# sourceMappingURL=runtimeMismatch.js.map