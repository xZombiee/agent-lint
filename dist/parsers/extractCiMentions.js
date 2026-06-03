const PROVIDER_PATTERNS = [
    ["github-actions", /\b(GitHub Actions|Actions workflow)\b/iu],
    ["circleci", /\bCircleCI\b/iu],
    ["gitlab-ci", /\bGitLab CI\b/iu],
    ["vercel", /\bVercel\b/iu],
    ["netlify", /\bNetlify\b/iu],
];
function inferProvider(line) {
    return PROVIDER_PATTERNS.find(([, pattern]) => pattern.test(line))?.[0] ?? null;
}
function extractNamesAfterKeyword(line, keyword) {
    const pattern = new RegExp(`\\b${keyword}\\s+[\`"'](?<name>[A-Za-z0-9_.:-]+)[\`"']`, "giu");
    return [...line.matchAll(pattern)]
        .map((match) => match.groups?.name)
        .filter((name) => Boolean(name));
}
function buildMention(provider, kind, line, lineNumber, name) {
    const mention = {
        provider,
        kind,
        line: lineNumber,
        instructionText: line.trim(),
    };
    if (name) {
        mention.name = name;
    }
    return mention;
}
export function extractCiMentions(content) {
    const mentions = [];
    const lines = content.split(/\r?\n/u);
    lines.forEach((line, index) => {
        const provider = inferProvider(line);
        if (!provider) {
            return;
        }
        const lineNumber = index + 1;
        mentions.push(buildMention(provider, "provider", line, lineNumber));
        if (provider !== "github-actions") {
            return;
        }
        if (/\bworkflow\b/iu.test(line)) {
            for (const name of extractNamesAfterKeyword(line, "workflow")) {
                mentions.push(buildMention(provider, "workflow", line, lineNumber, name));
            }
        }
        if (/\bjob\b/iu.test(line)) {
            for (const name of extractNamesAfterKeyword(line, "job")) {
                mentions.push(buildMention(provider, "job", line, lineNumber, name));
            }
        }
    });
    return mentions;
}
//# sourceMappingURL=extractCiMentions.js.map