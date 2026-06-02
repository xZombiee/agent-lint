export function getLineNumber(content, searchText, startLine = 1) {
    const lines = content.split(/\r?\n/u);
    for (let index = Math.max(0, startLine - 1); index < lines.length; index += 1) {
        if (lines[index]?.includes(searchText)) {
            return index + 1;
        }
    }
    return undefined;
}
//# sourceMappingURL=getLineNumber.js.map