#!/usr/bin/env node
import { runAgentLint } from "./index.js";
const HELP_TEXT = `Agent Lint

Usage:
  agent-lint [options]

Options:
  --json                 Print the JSON report to stdout
  --codex                Print the Codex handoff summary to stdout
  --ci                   Exit with code 1 when issues are found
  --write-summary        Write .agent-lint/report.json and .agent-lint/summary.md
  --config <path>        Load configuration from a custom JSON file
  --project <path>       Scan a specific project directory
  -h, --help             Show this help text
`;
function readOptionValue(argv, index, flagName) {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for ${flagName}.`);
    }
    return value;
}
function parseArguments(argv) {
    const options = {
        outputMode: "terminal",
        ci: false,
        writeSummary: false,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        switch (argument) {
            case "--json":
                if (options.outputMode === "codex") {
                    throw new Error("Use only one output mode: --json or --codex.");
                }
                options.outputMode = "json";
                break;
            case "--codex":
                if (options.outputMode === "json") {
                    throw new Error("Use only one output mode: --json or --codex.");
                }
                options.outputMode = "codex";
                break;
            case "--ci":
                options.ci = true;
                break;
            case "--write-summary":
                options.writeSummary = true;
                break;
            case "--config":
                options.configPath = readOptionValue(argv, index, "--config");
                index += 1;
                break;
            case "--project":
                options.projectRoot = readOptionValue(argv, index, "--project");
                index += 1;
                break;
            case "-h":
            case "--help":
                process.stdout.write(`${HELP_TEXT}\n`);
                process.exit(0);
                break;
            default:
                throw new Error(`Unknown argument: ${argument}`);
        }
    }
    return options;
}
async function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        const result = await runAgentLint(options);
        const outputMode = options.outputMode ?? "terminal";
        process.stdout.write(`${result.outputs[outputMode]}\n`);
        process.exitCode = result.exitCode;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    }
}
await main();
//# sourceMappingURL=cli.js.map