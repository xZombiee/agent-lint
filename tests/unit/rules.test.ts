import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig } from "../../src/config/defaultConfig.ts";
import { extractCiMentions } from "../../src/parsers/extractCiMentions.ts";
import { extractCommands } from "../../src/parsers/extractCommands.ts";
import { extractContradictionSignals } from "../../src/parsers/extractContradictionSignals.ts";
import { extractFilePaths } from "../../src/parsers/extractFilePaths.ts";
import { extractPackageManagerMentions } from "../../src/parsers/extractPackageManagerMentions.ts";
import { extractRuntimeMentions } from "../../src/parsers/extractRuntimeMentions.ts";
import { extractToolMentions } from "../../src/parsers/extractToolMentions.ts";
import { brokenFileReferences } from "../../src/rules/brokenFileReferences.ts";
import { ciReferenceMismatch } from "../../src/rules/ciReferenceMismatch.ts";
import { explicitContradictions } from "../../src/rules/explicitContradictions.ts";
import { missingPackageScripts } from "../../src/rules/missingPackageScripts.ts";
import { packageManagerMismatch } from "../../src/rules/packageManagerMismatch.ts";
import { runtimeMismatch } from "../../src/rules/runtimeMismatch.ts";
import { toolMismatch } from "../../src/rules/toolMismatch.ts";
import type { ParsedInstructionFile, ScanContext } from "../../src/types.ts";

function createInstructionFile(path: string, content: string): ParsedInstructionFile {
  return {
    path,
    content,
    fileReferences: extractFilePaths(content),
    commands: extractCommands(content),
    packageManagerMentions: extractPackageManagerMentions(content),
    runtimeMentions: extractRuntimeMentions(content),
    ciMentions: extractCiMentions(content),
    toolMentions: extractToolMentions(content),
    contradictionSignals: extractContradictionSignals(content),
  };
}

function createContext(instructionContent: string): ScanContext {
  return {
    projectRoot: "/repo",
    config: defaultConfig,
    repoFiles: ["src/lib/http.ts", "package.json"],
    repoDirectories: ["src", "src/lib"],
    gitIgnoreRules: [],
    trackedPaths: [],
    packageJson: {
      scripts: {
        "test:unit": "node --test",
      },
      dependencies: {
        "@reduxjs/toolkit": "^2.0.0",
      },
      devDependencies: {
        vitest: "^1.0.0",
      },
    },
    repoFacts: {
      packageManagers: {
        lockfiles: {
          npm: [],
          pnpm: [],
          yarn: [],
          bun: [],
        },
        workspaceFiles: [],
      },
      tools: {
        redux: {
          packages: ["@reduxjs/toolkit"],
          configFiles: [],
        },
        vitest: {
          packages: ["vitest"],
          configFiles: [],
        },
      },
      runtimes: {},
      ci: {
        providers: [],
        githubWorkflowFiles: [],
        githubWorkflowNames: [],
        githubJobIds: [],
      },
    },
    instructionFiles: [createInstructionFile("AGENTS.md", instructionContent)],
  };
}

test("brokenFileReferences emits an error and close path suggestion", () => {
  const issues = brokenFileReferences(
    createContext("Shared HTTP helpers live in `src/api/client.ts`."),
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "error");
  assert.equal(issues[0]?.suggestions?.[0], "src/lib/http.ts");
});

test("missingPackageScripts emits a warning for missing scripts", () => {
  const issues = missingPackageScripts(createContext("Run `npm test` before pushing."));

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "warning");
  assert.match(issues[0]?.evidence.repoFact ?? "", /no "test" script/u);
});

test("toolMismatch emits a warning when an alternative tool is installed", () => {
  const issues = toolMismatch(createContext("Use Jest for unit tests."));

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "warning");
  assert.match(issues[0]?.evidence.repoFact ?? "", /Vitest/u);
});

test("toolMismatch uses config files as tool evidence", () => {
  const context = createContext("Use Jest for unit tests.");
  context.packageJson = null;
  context.repoFacts.tools = {
    vitest: {
      packages: [],
      configFiles: ["vitest.config.ts"],
    },
  };

  const issues = toolMismatch(context);

  assert.equal(issues.length, 1);
  assert.match(issues[0]?.evidence.repoFact ?? "", /vitest\.config\.ts/u);
});

test("explicitContradictions emits warnings only for supported high-confidence contradictions", () => {
  const issues = explicitContradictions(
    createContext(`
Use Jest for unit tests.
Run npm test before pushing.
Do not use Redux in this repository.
Vitest is already configured.
`),
  );

  assert.equal(issues.length, 3);
  assert(issues.every((issue) => issue.severity === "warning"));
});

test("packageManagerMismatch warns when instructions use the wrong package manager", () => {
  const context = createContext("Run `npm install` and then `npm run test:unit`.");
  context.repoFacts.packageManagers = {
    declared: "pnpm",
    lockfiles: {
      npm: [],
      pnpm: ["pnpm-lock.yaml"],
      yarn: [],
      bun: [],
    },
    workspaceFiles: ["pnpm-workspace.yaml"],
  };

  const issues = packageManagerMismatch(context);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "warning");
  assert.match(issues[0]?.evidence.repoFact ?? "", /pnpm/u);
});

test("runtimeMismatch warns when instruction runtime version conflicts with repo metadata", () => {
  const context = createContext("Requires Node 18 for local development.");
  context.repoFacts.runtimes = {
    node: [{ source: "package.json engines.node", version: ">=20.10.0" }],
  };

  const issues = runtimeMismatch(context);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "warning");
  assert.match(issues[0]?.evidence.repoFact ?? "", /20\.10\.0/u);
});

test("ciReferenceMismatch validates concrete GitHub Actions workflow and job names", () => {
  const context = createContext("GitHub Actions workflow `deploy` must pass job `publish`.");
  context.repoFacts.ci = {
    providers: ["github-actions"],
    githubWorkflowFiles: [".github/workflows/ci.yml"],
    githubWorkflowNames: ["ci"],
    githubJobIds: ["test"],
  };

  const issues = ciReferenceMismatch(context);

  assert.equal(issues.length, 2);
  assert.deepStrictEqual(
    issues.map((issue) => issue.message),
    ["Missing GitHub Actions workflow", "Missing GitHub Actions job"],
  );
});

test("brokenFileReferences ignores example ignored artifact paths in free text", () => {
  const context = createContext(
    "Store temporary analysis artifacts only in a git-ignored path such as `.codex/`, `tmp/`, or another explicitly ignored reports directory.",
  );
  context.gitIgnoreRules = [
    {
      pattern: "reports/",
      basePath: "",
      source: ".gitignore",
    },
  ];

  const issues = brokenFileReferences(context);

  assert.equal(issues.length, 0);
});

test("brokenFileReferences downgrades missing directories to warnings", () => {
  const issues = brokenFileReferences(createContext("Use docs/runbooks/ for operational notes."));

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "warning");
});

test("brokenFileReferences treats external repo references as informational only", () => {
  const issues = brokenFileReferences(createContext("Publish repo: `openclaw/docs`."));

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "info");
  assert.equal(issues[0]?.referenceKind, "external");
});

test("brokenFileReferences resolves glob patterns against repository files", () => {
  const context = createContext("Source docs live in `docs/**`.");
  context.repoFiles.push("docs/guide/getting-started.md");
  context.repoDirectories.push("docs", "docs/guide");

  const issues = brokenFileReferences(context);

  assert.equal(issues.length, 0);
});

test("brokenFileReferences resolves docs route links and bare filenames by basename", () => {
  const context = createContext(`
See [Config](/gateway/configuration).
The flow runs in \`docs-sync-publish.yml\`.
`);
  context.instructionFiles = [createInstructionFile("docs/AGENTS.md", `
See [Config](/gateway/configuration).
The flow runs in \`docs-sync-publish.yml\`.
`)];
  context.repoFiles.push("docs/gateway/configuration.md", ".github/workflows/docs-sync-publish.yml");
  context.repoDirectories.push("docs", "docs/gateway", ".github", ".github/workflows");

  const issues = brokenFileReferences(context);

  assert.equal(issues.length, 0);
});

test("brokenFileReferences resolves directory references without trailing slash noise", () => {
  const context = createContext("Scoped guides live in `src/` and `src/lib/`.");

  const issues = brokenFileReferences(context);

  assert.equal(issues.length, 0);
});

test("brokenFileReferences suppresses unresolved environment assumptions", () => {
  const issues = brokenFileReferences(
    createContext("Use generated tiny plugin fixtures for `api.js` / `runtime-api.js` fallback behavior."),
  );

  assert.equal(issues.length, 0);
});

test("brokenFileReferences does not treat negated ignore rules as safe artifact paths", () => {
  const context = createContext(
    "Store temporary analysis artifacts only in a git-ignored path such as `.codex/`, `tmp/`, or another explicitly ignored reports directory.",
  );
  context.gitIgnoreRules = [
    {
      pattern: "!reports/keepme",
      basePath: "",
      source: ".gitignore",
    },
  ];

  const issues = brokenFileReferences(context);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.severity, "info");
});
