import path from "node:path";
function normalizeValue(value) {
    return value.replace(/\\/gu, "/").replace(/^\.\//u, "").toLowerCase();
}
function levenshteinDistance(left, right) {
    const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
    for (let row = 0; row <= left.length; row += 1) {
        matrix[row][0] = row;
    }
    for (let column = 0; column <= right.length; column += 1) {
        matrix[0][column] = column;
    }
    for (let row = 1; row <= left.length; row += 1) {
        for (let column = 1; column <= right.length; column += 1) {
            const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
            matrix[row][column] = Math.min(matrix[row - 1][column] + 1, matrix[row][column - 1] + 1, matrix[row - 1][column - 1] + substitutionCost);
        }
    }
    return matrix[left.length][right.length];
}
function commonPrefixSegments(left, right) {
    const leftSegments = normalizeValue(left).split("/");
    const rightSegments = normalizeValue(right).split("/");
    let prefixCount = 0;
    while (prefixCount < leftSegments.length && prefixCount < rightSegments.length) {
        if (leftSegments[prefixCount] !== rightSegments[prefixCount]) {
            break;
        }
        prefixCount += 1;
    }
    return prefixCount;
}
function scoreCandidate(target, candidate) {
    const normalizedTarget = normalizeValue(target);
    const normalizedCandidate = normalizeValue(candidate);
    const targetBase = path.posix.basename(normalizedTarget);
    const candidateBase = path.posix.basename(normalizedCandidate);
    const targetExtension = path.posix.extname(normalizedTarget);
    const candidateExtension = path.posix.extname(normalizedCandidate);
    const distance = levenshteinDistance(normalizedTarget, normalizedCandidate);
    const maxLength = Math.max(normalizedTarget.length, normalizedCandidate.length, 1);
    const similarity = 1 - distance / maxLength;
    let score = similarity * 4;
    if (targetBase === candidateBase) {
        score += 3;
    }
    else if (candidateBase.includes(targetBase.replace(targetExtension, ""))) {
        score += 1.5;
    }
    if (targetExtension !== "" && targetExtension === candidateExtension) {
        score += 1;
    }
    score += commonPrefixSegments(normalizedTarget, normalizedCandidate) * 0.5;
    return score;
}
export function findClosestMatches(target, candidates, limit = 3) {
    return candidates
        .map((candidate) => ({
        candidate,
        score: scoreCandidate(target, candidate),
    }))
        .filter(({ score }) => score >= 1.8)
        .sort((left, right) => right.score - left.score || left.candidate.localeCompare(right.candidate))
        .slice(0, limit)
        .map(({ candidate }) => candidate);
}
export function findClosestPaths(targetPath, repoFiles, limit = 3) {
    return findClosestMatches(targetPath, repoFiles, limit);
}
//# sourceMappingURL=pathSimilarity.js.map