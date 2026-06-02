export const defaultConfig = {
    instructionFiles: [
        "AGENTS.md",
        "**/AGENTS.md",
        "agents.md",
        "**/agents.md",
        "CLAUDE.md",
        "**/CLAUDE.md",
        "claude.md",
        "**/claude.md",
        ".cursor/rules/*.mdc",
        "**/.cursor/rules/*.mdc",
        ".github/copilot-instructions.md",
        "**/.github/copilot-instructions.md",
    ],
    ignorePaths: ["node_modules", "dist", "build", ".next", ".git"],
    artifactDir: ".agent-lint",
    rules: {
        brokenFileReferences: true,
        missingPackageScripts: true,
        toolMismatch: true,
        explicitContradictions: true,
    },
    severity: {
        brokenFileReferences: "error",
        missingPackageScripts: "warning",
        toolMismatch: "warning",
        explicitContradictions: "warning",
    },
};
//# sourceMappingURL=defaultConfig.js.map