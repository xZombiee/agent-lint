import { defaultConfig } from "./defaultConfig.js";
const RULE_NAMES = [
    "brokenFileReferences",
    "missingPackageScripts",
    "toolMismatch",
    "explicitContradictions",
];
const VALID_SEVERITIES = ["info", "warning", "error"];
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function expectStringArray(value, fieldName) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        throw new Error(`Invalid "${fieldName}" value in agent-lint config.`);
    }
    return value;
}
export function parseConfigObject(rawConfig) {
    if (!isPlainObject(rawConfig)) {
        throw new Error("Agent Lint config must be a JSON object.");
    }
    const allowedTopLevelKeys = new Set([
        "instructionFiles",
        "ignorePaths",
        "artifactDir",
        "rules",
        "severity",
    ]);
    for (const key of Object.keys(rawConfig)) {
        if (!allowedTopLevelKeys.has(key)) {
            throw new Error(`Unknown config field "${key}" in agent-lint config.`);
        }
    }
    const parsedConfig = {};
    if ("instructionFiles" in rawConfig) {
        parsedConfig.instructionFiles = expectStringArray(rawConfig.instructionFiles, "instructionFiles");
    }
    if ("ignorePaths" in rawConfig) {
        parsedConfig.ignorePaths = expectStringArray(rawConfig.ignorePaths, "ignorePaths");
    }
    if ("artifactDir" in rawConfig) {
        if (typeof rawConfig.artifactDir !== "string") {
            throw new Error('Invalid "artifactDir" value in agent-lint config.');
        }
        parsedConfig.artifactDir = rawConfig.artifactDir;
    }
    if ("rules" in rawConfig) {
        if (!isPlainObject(rawConfig.rules)) {
            throw new Error('Invalid "rules" value in agent-lint config.');
        }
        parsedConfig.rules = {};
        for (const [key, value] of Object.entries(rawConfig.rules)) {
            if (!RULE_NAMES.includes(key)) {
                throw new Error(`Unknown rule "${key}" in agent-lint config.`);
            }
            if (typeof value !== "boolean") {
                throw new Error(`Invalid rule toggle for "${key}" in agent-lint config.`);
            }
            parsedConfig.rules[key] = value;
        }
    }
    if ("severity" in rawConfig) {
        if (!isPlainObject(rawConfig.severity)) {
            throw new Error('Invalid "severity" value in agent-lint config.');
        }
        parsedConfig.severity = {};
        for (const [key, value] of Object.entries(rawConfig.severity)) {
            if (!RULE_NAMES.includes(key)) {
                throw new Error(`Unknown severity override "${key}" in agent-lint config.`);
            }
            if (typeof value !== "string" || !VALID_SEVERITIES.includes(value)) {
                throw new Error(`Invalid severity "${value}" for "${key}" in agent-lint config.`);
            }
            parsedConfig.severity[key] = value;
        }
    }
    return parsedConfig;
}
export function resolveConfig(config = {}) {
    return {
        instructionFiles: config.instructionFiles ?? [...defaultConfig.instructionFiles],
        ignorePaths: config.ignorePaths ?? [...defaultConfig.ignorePaths],
        artifactDir: config.artifactDir ?? defaultConfig.artifactDir,
        rules: {
            ...defaultConfig.rules,
            ...config.rules,
        },
        severity: {
            ...defaultConfig.severity,
            ...config.severity,
        },
    };
}
//# sourceMappingURL=configSchema.js.map