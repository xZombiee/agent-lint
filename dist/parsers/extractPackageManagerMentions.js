const PACKAGE_MANAGER_PATTERN = /\b(?<manager>npm|pnpm|yarn|bun)\s+(?<rest>(?:-[A-Za-z-]+(?:[=\s]+[^\s`|;]+)?\s+)*(?:run\s+)?[A-Za-z0-9:_*.-]+)/giu;
function isInsideInlineCode(line, matchIndex) {
    const prefix = line.slice(0, matchIndex);
    const backtickCount = [...prefix.matchAll(/`/gu)].length;
    return backtickCount % 2 === 1;
}
function hasCommandCue(line, matchIndex) {
    const before = line.slice(Math.max(0, matchIndex - 64), matchIndex).toLowerCase();
    const after = line.slice(matchIndex).toLowerCase();
    return (isInsideInlineCode(line, matchIndex) ||
        /[$]\s*$/u.test(before) ||
        /\b(run|use|execute|install|before|after|then|with|via|using)\s*(?:[`"']?\s*)?$/u.test(before) ||
        (line.slice(0, matchIndex).trim() === "" && /^\b(?:npm|pnpm|yarn|bun)\s+/u.test(after)));
}
export function extractPackageManagerMentions(content) {
    const mentions = [];
    const lines = content.split(/\r?\n/u);
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine === "") {
            return;
        }
        for (const match of line.matchAll(PACKAGE_MANAGER_PATTERN)) {
            const packageManager = match.groups?.manager?.toLowerCase();
            const rest = match.groups?.rest;
            const matchIndex = match.index ?? 0;
            if (!packageManager || !rest || !hasCommandCue(line, matchIndex)) {
                continue;
            }
            const rawCommand = `${packageManager} ${rest}`.trim().replace(/[.,;:!?]+$/u, "");
            mentions.push({
                packageManager,
                rawCommand,
                line: index + 1,
                instructionText: trimmedLine,
            });
        }
    });
    return mentions;
}
//# sourceMappingURL=extractPackageManagerMentions.js.map