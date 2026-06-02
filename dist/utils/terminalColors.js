function detectColorSupport() {
    return process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
}
function wrap(code, value, useColor) {
    return useColor ? `\u001b[${code}m${value}\u001b[0m` : value;
}
export function resolveColorUsage(options) {
    return options?.useColor ?? detectColorSupport();
}
export function red(value, options) {
    return wrap(31, value, resolveColorUsage(options));
}
export function yellow(value, options) {
    return wrap(33, value, resolveColorUsage(options));
}
export function blue(value, options) {
    return wrap(34, value, resolveColorUsage(options));
}
export function green(value, options) {
    return wrap(32, value, resolveColorUsage(options));
}
//# sourceMappingURL=terminalColors.js.map