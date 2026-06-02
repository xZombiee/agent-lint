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
Use \`../shared/config.ts\` for inherited config.
Source docs stay under \`docs/**\` and plugin code under \`extensions/*/src/**\`.
`);

  assert.deepStrictEqual(
    references.map((reference) => reference.path),
    [
      "extensions/telegram/src/index.ts",
      ".github/workflows/docs-sync-publish.yml",
      "../shared/config.ts",
      "docs/**",
      "extensions/*/src/**",
    ],
  );
  assert(references.every((reference) => reference.kind === "hard"));
});

test("extractFilePaths parses markdown link targets and filters literal/version placeholders", () => {
  const references = extractFilePaths(`
Internal doc links in \`docs/**/*.md\` must stay root-relative with no \`.md\` or \`.mdx\` suffix (example: [Config](/gateway/configuration)).
Do not add localized docs under \`docs/<locale>/**\` here.
Update \`docs/.i18n/glossary.<locale>.json\` as needed.
Beta tags use \`vYYYY.M.D-beta.N\` and models like \`gpt-5.5\`, \`5.4\`, or \`GPT-4.x\`.
Configure \`agents.defaults.skills\`, \`agents.list[].skills\`, and \`.i18n\` metadata.
`);

  assert.deepStrictEqual(
    references.map((reference) => reference.path),
    ["/gateway/configuration", "docs/**/*.md"],
  );
});

test("extractFilePaths cleans wrapper leftovers without dropping real paths", () => {
  const references = extractFilePaths(`
No deep internals (\`extensions/*/src/**\`, \`onboard.js\`).
Run \`node scripts/run-vitest.mjs run --config test/vitest/vitest.tui-pty.config.ts\`.
Do not treat \`...\`, \`openclaw/plugin-sdk/*\`, or **Discord/WhatsApp:** as paths.
`);

  assert.deepStrictEqual(
    references.map((reference) => reference.path),
    [
      "scripts/run-vitest.mjs",
      "test/vitest/vitest.tui-pty.config.ts",
    ],
  );
});

test("extractFilePaths drops prose slash phrases and keeps external repo references separate", () => {
  const references = extractFilePaths(`
Docs/user-visible work: \`pnpm docs:list\`, then read relevant docs only.
Fix/triage answers need source, tests, current/shipped behavior, and dependency contract proof.
Prefer findings for docs/config mismatches and compat/deprecation noise.
Publish repo: \`openclaw/docs\`.
Plugin SDK exception: shipped external API gets new API first plus named compat/deprecation, small tests/docs if useful, removal plan.
Before sharing WebVNC links, verify real app/path works.
Handle real production states. Public/hostile/observed malformed input gets care.
Full suites: Docker/package/E2E/live/cross-OS proof.
Extension production code should import from \`openclaw/plugin-sdk/*\`.
Freshness exceptions need named owner + tests.
Prefer a small versioned host/kernel seam.
Optional integrations route to owner repos; keep core/plugin APIs local.
Backport means apply to newest open \`release/\` branch.
The publish output is often cloned locally as \`../openclaw-docs\`.
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
Use repo wrappers (\`pnpm format:*\`, \`pnpm lint:*\`) and avoid bare \`pnpm test*\`.
So pnpm runs inside Testbox, but this prose should not require a "runs" script.
Root/plugin npm packages ship shrinkwrap, but this prose should not require a "packages" script.
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
Never use bare Vitest in automation.
`);

  assert.deepStrictEqual(
    mentions.map((mention) => `${mention.tool}:${mention.stance}`),
    ["jest:use", "redux:avoid", "vitest:mention", "vitest:mention"],
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
