import assert from "node:assert/strict";
import test from "node:test";
import { extractCiMentions } from "../../src/parsers/extractCiMentions.ts";
import { extractCommands } from "../../src/parsers/extractCommands.ts";
import { extractFilePaths } from "../../src/parsers/extractFilePaths.ts";
import { extractPackageManagerMentions } from "../../src/parsers/extractPackageManagerMentions.ts";
import { extractRuntimeMentions } from "../../src/parsers/extractRuntimeMentions.ts";
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

test("extractFilePaths classifies reference-format examples as examples", () => {
  const references = extractFilePaths(`
Replies: repo-root refs only: \`extensions/telegram/src/index.ts:80\`. No absolute paths, no \`~/\`.
openclaw agents set-identity --agent main --avatar avatars/openclaw.png
avatar: "avatars/openclaw.png",
Example command: openclaw agents set-identity --avatar avatars/sample.png
`);

  assert.deepStrictEqual(
    references.map((reference) => [reference.path, reference.kind]),
    [
      ["extensions/telegram/src/index.ts", "example"],
      ["avatars/openclaw.png", "hard"],
      ["avatars/openclaw.png", "hard"],
      ["avatars/sample.png", "example"],
    ],
  );
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
- **\`src/extension/\`**: Main extension implementation.
`);

  assert.deepStrictEqual(
    references.map((reference) => [reference.path, reference.kind]),
    [
      ["scripts/run-vitest.mjs", "hard"],
      ["test/vitest/vitest.tui-pty.config.ts", "hard"],
      ["src/extension/", "example"],
    ],
  );
});

test("extractFilePaths ignores API member expressions and prose abbreviations", () => {
  const references = extractFilePaths(`
Use console.log only in examples; prefer ILogService.
for (let i = 0, n = str.length; i < 10; i++) {}
The pipeline writes to state.groups and Promise.all resolves metadata.
Trackpad pinch reports e.ctrlKey and Node.js-specific behavior.
This setting table includes \`mcp.enabled\` and \`branchSupport.enabled\`.
These docs mention e.g. and i.e. abbreviations.
`);

  assert.deepStrictEqual(references, []);
});

test("extractFilePaths treats runtime generated artifacts as environment assumptions", () => {
  const references = extractFilePaths(`
- \`events.jsonl\` — Ordered event stream.
- Stores image data as files in extension global storage (\`copilot-cli-images/\`).
`);

  assert.deepStrictEqual(
    references.map((reference) => [reference.path, reference.kind]),
    [
      ["events.jsonl", "env"],
      ["copilot-cli-images/", "env"],
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

test("extractPackageManagerMentions detects install and script commands", () => {
  const mentions = extractPackageManagerMentions(`
Run \`npm install\`, then pnpm run build.
This package mentions npm but is not a command.
`);

  assert.deepStrictEqual(
    mentions.map((mention) => `${mention.packageManager}:${mention.rawCommand}`),
    ["npm:npm install", "pnpm:pnpm run build"],
  );
});

test("extractRuntimeMentions detects concrete runtime versions", () => {
  const mentions = extractRuntimeMentions(`
Requires Node >=20.10.0.
Python 3.11 is used by scripts.
Java version 17 is required.
`);

  assert.deepStrictEqual(
    mentions.map((mention) => `${mention.runtime}:${mention.version}`),
    ["node:>=20.10.0", "python:3.11", "java:17"],
  );
});

test("extractCiMentions detects concrete GitHub Actions names", () => {
  const mentions = extractCiMentions("GitHub Actions workflow `ci` must pass job `test`.");

  assert.deepStrictEqual(
    mentions.map((mention) => `${mention.provider}:${mention.kind}:${mention.name ?? ""}`),
    ["github-actions:provider:", "github-actions:workflow:ci", "github-actions:job:test"],
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
