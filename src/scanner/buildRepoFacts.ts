import path from "node:path";
import { readFile } from "node:fs/promises";
import type {
  CiFacts,
  CiProvider,
  PackageJsonData,
  PackageManager,
  RepoFacts,
  RuntimeFact,
  RuntimeName,
  SupportedToolKey,
  ToolEvidence,
} from "../types.ts";
import { pathExists } from "../utils/pathExists.ts";
import { SUPPORTED_TOOLS } from "../utils/supportedTools.ts";

const PACKAGE_MANAGER_LOCKFILES: Array<[PackageManager, RegExp]> = [
  ["npm", /(^|\/)(package-lock\.json|npm-shrinkwrap\.json)$/u],
  ["pnpm", /(^|\/)pnpm-lock\.yaml$/u],
  ["yarn", /(^|\/)yarn\.lock$/u],
  ["bun", /(^|\/)bun\.lockb?$/u],
];

const TOOL_CONFIG_PATTERNS: Record<SupportedToolKey, RegExp[]> = {
  jest: [/(^|\/)jest\.config\.[cm]?[jt]s$/u],
  vitest: [/(^|\/)vitest\.config\.[cm]?[jt]s$/u],
  playwright: [/(^|\/)playwright\.config\.[cm]?[jt]s$/u],
  cypress: [/(^|\/)cypress\.config\.[cm]?[jt]s$/u, /(^|\/)cypress\//u],
  redux: [],
  zustand: [],
  eslint: [/(^|\/)eslint\.config\.[cm]?[jt]s$/u, /(^|\/)\.eslintrc(?:\..+)?$/u],
  biome: [/(^|\/)biome\.jsonc?$/u],
  prettier: [/(^|\/)\.prettierrc(?:\..+)?$/u, /(^|\/)prettier\.config\.[cm]?[jt]s$/u],
  tailwind: [/(^|\/)tailwind\.config\.[cm]?[jt]s$/u],
  prisma: [/(^|\/)schema\.prisma$/u, /(^|\/)prisma\//u],
  drizzle: [/(^|\/)drizzle\.config\.[cm]?[jt]s$/u],
  nextjs: [/(^|\/)next\.config\.[cm]?[jt]s$/u],
  vite: [/(^|\/)vite\.config\.[cm]?[jt]s$/u],
};

function parseDeclaredPackageManager(value?: string): PackageManager | undefined {
  const packageManager = value?.split("@")[0];

  if (
    packageManager === "npm" ||
    packageManager === "pnpm" ||
    packageManager === "yarn" ||
    packageManager === "bun"
  ) {
    return packageManager;
  }

  return undefined;
}

function collectPackageManagers(repoFiles: string[], packageJson: PackageJsonData | null): RepoFacts["packageManagers"] {
  const lockfiles: Record<PackageManager, string[]> = {
    npm: [],
    pnpm: [],
    yarn: [],
    bun: [],
  };

  for (const repoFile of repoFiles) {
    for (const [packageManager, pattern] of PACKAGE_MANAGER_LOCKFILES) {
      if (pattern.test(repoFile)) {
        lockfiles[packageManager].push(repoFile);
      }
    }
  }

  const result: RepoFacts["packageManagers"] = {
    lockfiles,
    workspaceFiles: repoFiles.filter((repoFile) =>
      /(^|\/)(pnpm-workspace\.yaml|lerna\.json|rush\.json|turbo\.json|nx\.json)$/u.test(repoFile),
    ),
  };

  const declared = parseDeclaredPackageManager(packageJson?.packageManager);

  if (declared) {
    result.declared = declared;
  }

  return result;
}

function collectTools(repoFiles: string[], packageJson: PackageJsonData | null): RepoFacts["tools"] {
  const packageNames = new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ]);
  const tools: Partial<Record<SupportedToolKey, ToolEvidence>> = {};

  for (const tool of SUPPORTED_TOOLS) {
    const packages = tool.packages.filter((packageName) => packageNames.has(packageName));
    const configFiles = repoFiles.filter((repoFile) =>
      TOOL_CONFIG_PATTERNS[tool.key].some((pattern) => pattern.test(repoFile)),
    );

    if (packages.length > 0 || configFiles.length > 0) {
      tools[tool.key] = { packages, configFiles };
    }
  }

  return tools;
}

async function readOptionalText(projectRoot: string, repoPath: string): Promise<string | null> {
  const absolutePath = path.join(projectRoot, repoPath);

  if (!(await pathExists(absolutePath))) {
    return null;
  }

  return readFile(absolutePath, "utf8");
}

function addRuntimeFact(
  runtimes: Partial<Record<RuntimeName, RuntimeFact[]>>,
  runtime: RuntimeName,
  source: string,
  version: string | undefined,
): void {
  const normalizedVersion = version?.trim();

  if (!normalizedVersion) {
    return;
  }

  const facts = runtimes[runtime] ?? [];
  facts.push({ source, version: normalizedVersion });
  runtimes[runtime] = facts;
}

async function collectRuntimes(
  projectRoot: string,
  repoFiles: string[],
  packageJson: PackageJsonData | null,
): Promise<RepoFacts["runtimes"]> {
  const runtimes: Partial<Record<RuntimeName, RuntimeFact[]>> = {};

  addRuntimeFact(runtimes, "node", "package.json engines.node", packageJson?.engines?.node);

  for (const [repoPath, runtime] of [
    [".nvmrc", "node"],
    [".node-version", "node"],
    [".python-version", "python"],
    [".java-version", "java"],
  ] as const) {
    const content = await readOptionalText(projectRoot, repoPath);
    addRuntimeFact(runtimes, runtime, repoPath, content?.split(/\r?\n/u)[0]);
  }

  if (repoFiles.includes(".tool-versions")) {
    const content = await readOptionalText(projectRoot, ".tool-versions");

    for (const line of content?.split(/\r?\n/u) ?? []) {
      const match = /^(?<tool>nodejs|node|python|java)\s+(?<version>\S+)/u.exec(line.trim());
      const tool = match?.groups?.tool;
      const version = match?.groups?.version;

      if (!tool || !version) {
        continue;
      }

      addRuntimeFact(runtimes, tool.startsWith("node") ? "node" : tool as RuntimeName, ".tool-versions", version);
    }
  }

  if (repoFiles.includes("mise.toml")) {
    const content = await readOptionalText(projectRoot, "mise.toml");

    for (const line of content?.split(/\r?\n/u) ?? []) {
      const match = /^(?<tool>node|python|java)\s*=\s*["'](?<version>[^"']+)["']/u.exec(line.trim());

      if (match?.groups?.tool && match.groups.version) {
        addRuntimeFact(runtimes, match.groups.tool as RuntimeName, "mise.toml", match.groups.version);
      }
    }
  }

  return runtimes;
}

function collectCiProviders(repoFiles: string[]): CiProvider[] {
  const providers = new Set<CiProvider>();

  if (repoFiles.some((repoFile) => repoFile.startsWith(".github/workflows/"))) {
    providers.add("github-actions");
  }

  if (repoFiles.includes(".circleci/config.yml") || repoFiles.includes(".circleci/config.yaml")) {
    providers.add("circleci");
  }

  if (repoFiles.includes(".gitlab-ci.yml") || repoFiles.includes(".gitlab-ci.yaml")) {
    providers.add("gitlab-ci");
  }

  if (repoFiles.includes("vercel.json")) {
    providers.add("vercel");
  }

  if (repoFiles.includes("netlify.toml")) {
    providers.add("netlify");
  }

  return [...providers];
}

function normalizeWorkflowName(value: string): string {
  return value.trim().replace(/^["']|["']$/gu, "");
}

async function collectCiFacts(projectRoot: string, repoFiles: string[]): Promise<CiFacts> {
  const githubWorkflowFiles = repoFiles.filter((repoFile) =>
    /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(repoFile),
  );
  const githubWorkflowNames = new Set<string>();
  const githubJobIds = new Set<string>();

  for (const workflowFile of githubWorkflowFiles) {
    githubWorkflowNames.add(path.posix.basename(workflowFile, path.posix.extname(workflowFile)));

    const content = await readOptionalText(projectRoot, workflowFile);
    let insideJobs = false;

    for (const line of content?.split(/\r?\n/u) ?? []) {
      const nameMatch = /^name:\s*(?<name>.+)$/u.exec(line);

      if (nameMatch?.groups?.name) {
        githubWorkflowNames.add(normalizeWorkflowName(nameMatch.groups.name));
      }

      if (/^jobs:\s*$/u.test(line)) {
        insideJobs = true;
        continue;
      }

      if (insideJobs && /^\S/u.test(line)) {
        insideJobs = false;
      }

      if (!insideJobs) {
        continue;
      }

      const jobMatch = /^  (?<job>[A-Za-z0-9_-]+):\s*$/u.exec(line);

      if (jobMatch?.groups?.job) {
        githubJobIds.add(jobMatch.groups.job);
      }
    }
  }

  return {
    providers: collectCiProviders(repoFiles),
    githubWorkflowFiles,
    githubWorkflowNames: [...githubWorkflowNames],
    githubJobIds: [...githubJobIds],
  };
}

export async function buildRepoFacts(
  projectRoot: string,
  repoFiles: string[],
  packageJson: PackageJsonData | null,
): Promise<RepoFacts> {
  return {
    packageManagers: collectPackageManagers(repoFiles, packageJson),
    tools: collectTools(repoFiles, packageJson),
    runtimes: await collectRuntimes(projectRoot, repoFiles, packageJson),
    ci: await collectCiFacts(projectRoot, repoFiles),
  };
}
