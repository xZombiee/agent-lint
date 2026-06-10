# agent-lint

Find stale AGENTS.md guidance before your agent follows it.

`agent-lint` checks AI coding instructions against real repository facts. It catches broken paths, missing commands, outdated tooling assumptions, and contradictory guidance before Codex, Claude, Cursor, Copilot, or another coding agent follows stale instructions.

## Install

Install from npm:

```bash
npm install -g @xzombiee/agent-lint
```

Run it:

```bash
agent-lint
```

Project-local install:

```bash
npm install -D @xzombiee/agent-lint
npm exec agent-lint
```

GitHub tarball fallback:

```bash
npm install -g https://github.com/xZombiee/agent-lint/archive/refs/heads/main.tar.gz
```

## Quick start

Scan the current repository:

```bash
agent-lint
```

Scan another repository:

```bash
agent-lint --project ../some-other-repo
```

Use a config file:

```bash
agent-lint --config agent-lint.config.json
```

## Example

An instruction file says:

```md
Run `npm test` before submitting.

Shared HTTP helpers live in `src/api/client.ts`.

Use Jest for tests.

Do not use Redux.
```

But the repository facts say:

```txt
package.json has no "test" script.
src/api/client.ts does not exist.
Vitest is installed, Jest is not.
Redux packages are installed.
```

`agent-lint` reports:

```txt
Agent Lint

Scanned 1 instruction file.
Found 4 issues: 1 error, 3 warnings, 0 infos.

ERROR AGENTS.md:3 Broken file reference
Instruction says: Shared HTTP helpers live in `src/api/client.ts`.
Repo fact: "src/api/client.ts" does not exist.
Suggestion: Use `src/lib/http.ts` or update the instruction.

WARNING AGENTS.md:1 Missing package script
Instruction says: Run `npm test` before submitting.
Repo fact: package.json has no "test" script.

WARNING AGENTS.md:5 Tool mismatch
Instruction says: Use Jest for tests.
Repo fact: Vitest is installed, Jest is not.

WARNING AGENTS.md:7 Explicit contradiction
Instruction says: Do not use Redux.
Repo fact: Redux packages are installed.
```

## Why it matters

AI coding agents are only as reliable as the instructions they read.

Modern repositories often contain agent-facing files such as `AGENTS.md`, `CLAUDE.md`, Cursor rules, and GitHub Copilot instructions. These files tell agents where code lives, which commands to run, which tools to use, and which workflows to avoid.

But repositories change. Instructions drift.

A stale instruction can make an agent search for deleted files, run missing scripts, follow outdated tooling guidance, or waste tokens, CI runs, and reviewer time.

`agent-lint` turns that hidden instruction drift into visible, reviewable issues.

## Available modes

```bash
agent-lint
agent-lint --json
agent-lint --codex
agent-lint --write-summary
agent-lint --ci
agent-lint --config agent-lint.config.json
agent-lint --project ../some-other-repo
```

## What it checks

`agent-lint` focuses on factual checks:

- broken file references
- missing package scripts
- installed-vs-mentioned tool mismatches
- narrow, high-confidence instruction contradictions

It does not edit repository files. It only reports issues and suggestions.

## Output

Default output is designed for humans:

```txt
Agent Lint

Scanned 3 instruction files.
Found 4 issues: 1 error, 3 warnings, 0 infos.

ERROR AGENTS.md:12 Broken file reference
Instruction says: Shared HTTP helpers live in `src/api/client.ts`.
Repo fact: "src/api/client.ts" does not exist.
Suggestion: Use `src/lib/http.ts` or update the instruction.
```

Severity levels:

- `error`: likely broken instruction
- `warning`: suspicious instruction drift
- `info`: external, environment-specific, or intentionally unverifiable reference

Set `NO_COLOR=1` to disable terminal colors.

## CI

Use `--ci` in automated checks:

```bash
agent-lint --ci
```

Exit codes:

```txt
0  no issues found
1  warnings or errors found
```

## JSON output

Use `--json` for automation:

```bash
agent-lint --json
```

The JSON report includes scanned files, summary counts, issue severity, source file and line, instruction text, repository fact, and optional suggestions.

## Codex handoff

Use `--codex` to generate a compact Markdown fix queue for a coding agent:

```bash
agent-lint --codex
```

The summary groups actionable issues by file, breaks long file entries into short lines, compresses repeated info notes, and avoids boilerplate so an agent can fix instruction drift without loading the full report.

## Artifact writing

Use `--write-summary` to write reports to `.agent-lint/`:

```bash
agent-lint --write-summary
```

Generated files:

```txt
.agent-lint/report.json
.agent-lint/summary.md
```

Standard scans do not write files.

To ignore generated artifacts, add this to `.gitignore`:

```gitignore
.agent-lint/
```

## Supported instruction files

By default, `agent-lint` scans:

- `AGENTS.md`
- `**/AGENTS.md`
- `agents.md`
- `**/agents.md`
- `CLAUDE.md`
- `**/CLAUDE.md`
- `claude.md`
- `**/claude.md`
- `.cursor/rules/*.mdc`
- `**/.cursor/rules/*.mdc`
- `.github/copilot-instructions.md`
- `**/.github/copilot-instructions.md`

Nested instruction files are supported.

## Configuration

`agent-lint` supports a single JSON config file:

```txt
agent-lint.config.json
```

Example:

```json
{
  "instructionFiles": [
    "AGENTS.md",
    "**/AGENTS.md",
    "CLAUDE.md",
    "**/CLAUDE.md",
    ".cursor/rules/*.mdc",
    "**/.cursor/rules/*.mdc",
    ".github/copilot-instructions.md",
    "**/.github/copilot-instructions.md"
  ],
  "ignorePaths": ["node_modules", "dist", "build", ".next", ".git"],
  "artifactDir": ".agent-lint",
  "rules": {
    "brokenFileReferences": true,
    "missingPackageScripts": true,
    "toolMismatch": true,
    "explicitContradictions": true
  }
}
```

## Scope

`agent-lint` is optimized for Node and TypeScript repositories.

It can scan any repository, but package-script and tool checks are most reliable when `package.json` is present.

## Limitations

`agent-lint` checks facts that can be verified locally:

- does this file exist?
- does this directory exist?
- does this package script exist?
- is this tool installed?
- does this instruction contradict an obvious repository fact?

It does not try to understand every instruction, and it does not replace human review.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

Run all checks:

```bash
npm run check
```

## License

MIT
