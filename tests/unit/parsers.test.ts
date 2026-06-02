import assert from "node:assert/strict";
import test from "node:test";
import { extractCommands } from "../../src/parsers/extractCommands.ts";
import { extractFilePaths } from "../../src/parsers/extractFilePaths.ts";
import { extractToolMentions } from "../../src/parsers/extractToolMentions.ts";

test("extractFilePaths returns only likely repository paths", () => {
  const references = extractFilePaths(`
Use \`src/lib/http.ts\` for shared HTTP code.
See .github/copilot-instructions.md for agent guidance.
Open package.json before editing scripts.
Ignore https://example.com/docs and @scope/package.
`);

  assert.deepStrictEqual(
    references.map((reference) => reference.path),
    ["src/lib/http.ts", ".github/copilot-instructions.md", "package.json"],
  );
  assert.equal(references[0]?.token, "src/lib/http.ts");
  assert.equal(references[0]?.kind, "hard");
});

test("extractFilePaths preserves explicit local paths, globs, and line anchors", () => {
  const references = extractFilePaths(`
Replies use \`extensions/telegram/src/index.ts:80\` and \`.github/workflows/docs-sync-publish.yml\`.
Installers live in sibling \`../openclaw.ai\`.
Source docs stay under \`docs/**\` and plugin code under \`extensions/*/src/**\`.
`);

  assert.deepStrictEqual(
    references.map((reference) => reference.path),
    [
      "extensions/telegram/src/index.ts",
      ".github/workflows/docs-sync-publish.yml",
      "../openclaw.ai",
      "docs/**",
      "extensions/*/src/**",
    ],
  );
  assert(references.every((reference) => reference.kind === "hard"));
});

test("extractFilePaths drops prose slash phrases and keeps external repo references separate", () => {
  const references = extractFilePaths(`
Docs/user-visible work: \`pnpm docs:list\`, then read relevant docs only.
Fix/triage answers need source, tests, current/shipped behavior, and dependency contract proof.
Prefer findings for docs/config mismatches and compat/deprecation noise.
Publish repo: \`openclaw/docs\`.
`);

  assert.deepStrictEqual(
    references.map((reference) => [reference.path, reference.kind]),
    [["openclaw/docs", "external"]],
  );
});

test("extractCommands detects package-manager script references", () => {
  const commands = extractCommands(`
Run npm test before pushing.
Then run npm run lint.
Use pnpm build for production checks.
Do not treat npm install as a script command.
`);

  assert.deepStrictEqual(
    commands.map((command) => `${command.packageManager}:${command.scriptName}`),
    ["npm:test", "npm:lint", "pnpm:build"],
  );
});

test("extractToolMentions detects positive and negative tool guidance", () => {
  const mentions = extractToolMentions(`
Use Jest for unit tests.
Do not use Redux in this repository.
Vitest is already configured.
`);

  assert.deepStrictEqual(
    mentions.map((mention) => `${mention.tool}:${mention.stance}`),
    ["jest:use", "redux:avoid", "vitest:mention"],
  );
});

test("extractFilePaths classifies policy and nested directory references", () => {
  const references = extractFilePaths(`
# Generated Artifacts
Store temporary analysis artifacts only in a git-ignored path such as \`.codex/\`, \`tmp/\`, or another explicitly ignored reports directory.
`);

  assert.equal(references[0]?.kind, "policy");
  assert.equal(references[0]?.target, "dir");
  assert.equal(references[0]?.section, "Generated Artifacts");
});
