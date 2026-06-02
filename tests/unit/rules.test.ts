import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig } from "../../src/config/defaultConfig.ts";
import { extractCommands } from "../../src/parsers/extractCommands.ts";
import { extractContradictionSignals } from "../../src/parsers/extractContradictionSignals.ts";
import { extractFilePaths } from "../../src/parsers/extractFilePaths.ts";
import { extractToolMentions } from "../../src/parsers/extractToolMentions.ts";
import { brokenFileReferences } from "../../src/rules/brokenFileReferences.ts";
import { explicitContradictions } from "../../src/rules/explicitContradictions.ts";
import { missingPackageScripts } from "../../src/rules/missingPackageScripts.ts";
import { toolMismatch } from "../../src/rules/toolMismatch.ts";
import type { ParsedInstructionFile, ScanContext } from "../../src/types.ts";

function createInstructionFile(path: string, content: string): ParsedInstructionFile {
  return {
    path,
    content,
    fileReferences: extractFilePaths(content),
    commands: extractCommands(content),
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
