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
