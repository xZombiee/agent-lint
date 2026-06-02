# agent-lint

CLI that lints stale, broken, and contradictory AI coding instructions in your repository.

## What It Does

Agent Lint validates repository instruction files against repository facts before a coding agent relies on them.

V0.1 focuses on factual checks only:

- Broken file references in instruction files
- Missing package scripts mentioned in instructions
- Installed-vs-mentioned tool mismatches
- A narrow class of explicit instruction contradictions

V0.1 does not edit repository files. It reports issues and suggestions only.

## Scope

Agent Lint is optimized for Node and TypeScript repositories.

It can scan any repository, but package and tool checks only have strong guarantees when `package.json` is present.

## Install

Run it directly with `npx`:

```bash
npx agent-lint
```

Or install it as a dev dependency:

```bash
npm install -D agent-lint
```

## Usage

Default local scan:

```bash
agent-lint
```

Available modes:

```bash
agent-lint
agent-lint --json
agent-lint --codex
agent-lint --write-summary
agent-lint --ci
agent-lint --config agent-lint.config.json
agent-lint --project ../some-other-repo
```

## Output Modes

### Terminal report

Default output is concise and actionable.

Severity colors in terminal mode:

- `error`: red
- `warning`: yellow
- `info`: blue
- clean scan: green

Set `NO_COLOR=1` to disable ANSI colors.

Example:

```txt
Agent Lint

Scanned 3 instruction files.
Found 4 issues: 1 error, 3 warning, 0 info.

ERROR AGENTS.md:12 Broken file reference
Instruction says: Shared HTTP helpers live in src/api/client.ts.
Repo fact: "src/api/client.ts" does not exist in the repository.
Suggestion: Use src/lib/http.ts or update the instruction.
```

### JSON report

`--json` prints the stable automation interface to stdout.

Schema:

```ts
type IssueSeverity = "info" | "warning" | "error";

type AgentLintIssue = {
  id: string;
  rule:
    | "brokenFileReferences"
    | "missingPackageScripts"
    | "toolMismatch"
    | "explicitContradictions";
  severity: IssueSeverity;
  sourceFile: string;
  line?: number;
  message: string;
  referenceKind?: "hard" | "example" | "policy" | "env";
  evidence: {
    instructionText: string;
    repoFact: string;
  };
  suggestion?: string;
  suggestions?: string[];
};

type AgentLintReport = {
  projectRoot: string;
  scannedFiles: string[];
  summary: {
    issueCount: number;
    infoCount: number;
    warningCount: number;
    errorCount: number;
  };
  issues: AgentLintIssue[];
};
```

### Codex handoff summary

`--codex` prints a Markdown summary meant for copy/paste into a coding agent workflow.

The summary tells the agent to:

- Prefer repository facts over stale instructions
- Update contradicted instruction files before relying on them
- Rerun Agent Lint after remediation

## Artifact Writing

`--write-summary` writes artifacts to `.agent-lint/` by default:

- `.agent-lint/report.json`
- `.agent-lint/summary.md`

Standard scans do not write files.

If you want the artifacts ignored by Git, add:

```gitignore
.agent-lint/
```

## CI

Recommended CI command:

```bash
agent-lint --ci
```

CI semantics in V0.1:

- Exit `0`: no issues
- Exit `1`: warnings and/or errors found

## Supported Instruction Files

Default discovery patterns:

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

Nested instruction files are scanned, so a repository can keep local `AGENTS.md` files inside subdirectories.

## Configuration

Agent Lint supports a single JSON config file:

```txt
agent-lint.config.json
```

Supported fields:

```json
{
  "instructionFiles": [
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
    "**/.github/copilot-instructions.md"
  ],
  "ignorePaths": ["node_modules", "dist", "build", ".next", ".git"],
  "artifactDir": ".agent-lint",
  "rules": {
    "brokenFileReferences": true,
    "missingPackageScripts": true,
    "toolMismatch": true,
    "explicitContradictions": true
  },
  "severity": {
    "brokenFileReferences": "error",
    "missingPackageScripts": "warning",
    "toolMismatch": "warning",
    "explicitContradictions": "warning"
  }
}
```

## Rule Coverage

### Broken file references

Detects path-like references in instruction files and classifies them before validating:

- `hard`: concrete repo paths
- `example`: illustrative paths
- `policy`: path-policy guidance such as ignored artifact locations
- `env`: environment or runtime assumptions

Hard references are resolved relative to the repository root and, for nested instruction files, relative to the instruction file directory as well.

Git-ignore checks consider repository `.gitignore` files, `.git/info/exclude`, and the configured global Git exclude file when available.

Default severities:

- missing hard files: `error`
- missing hard directories: `warning`
- unresolved example, policy, or environment paths: `info`

### Missing package scripts

Detects commands such as `npm test`, `npm run lint`, `pnpm build`, `yarn test`, and `bun test`, then checks whether the referenced script exists in `package.json`.

Default severity: `warning`

### Tool mismatch

Compares supported tool mentions in instructions against installed dependencies and devDependencies.

Initial supported tool list:

- Jest
- Vitest
- Playwright
- Cypress
- Redux
- Zustand
- ESLint
- Prettier
- Tailwind
- Prisma
- Drizzle
- Next.js
- Vite

Default severity: `warning`

### Explicit contradictions

Implements a narrow high-confidence contradiction class in V0.1.

Supported examples:

- “Do not use Redux” while Redux packages are installed
- “Use Jest” while Jest is absent and Vitest is present
- “Run npm test” while no `test` script exists

Default severity: `warning`

## Recommended Remediation Workflow

Human-led loop:

1. Run Agent Lint.
2. Review each finding.
3. Decide whether the instruction is stale or the repository drifted.
4. Update instructions or code accordingly.
5. Rerun Agent Lint.

Agent-assisted loop:

1. Run `agent-lint --codex`.
2. Provide the summary to your coding agent together with the target instruction files.
3. Ask the agent to fix stale instructions first and explain anything it cannot safely resolve.
4. Review the edits.
5. Rerun Agent Lint.

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

Run both:

```bash
npm run check
```
