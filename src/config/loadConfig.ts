import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseConfigObject, resolveConfig } from "./configSchema.ts";
import { pathExists } from "../utils/pathExists.ts";
import type { ResolvedAgentLintConfig } from "../types.ts";

const DEFAULT_CONFIG_NAME = "agent-lint.config.json";

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export async function loadConfig(
  projectRoot: string,
  explicitConfigPath?: string,
): Promise<ResolvedAgentLintConfig> {
  const resolvedConfigPath = explicitConfigPath
    ? path.resolve(projectRoot, explicitConfigPath)
    : path.join(projectRoot, DEFAULT_CONFIG_NAME);

  const configExists = await pathExists(resolvedConfigPath);

  if (!configExists) {
    if (explicitConfigPath) {
      throw new Error(`Config file not found: ${resolvedConfigPath}`);
    }

    const config = resolveConfig();
    return {
      ...config,
      ignorePaths: uniqueStrings([...config.ignorePaths, config.artifactDir]),
    };
  }

  const rawFile = await readFile(resolvedConfigPath, "utf8");
  const rawConfig = JSON.parse(rawFile) as unknown;
  const config = resolveConfig(parseConfigObject(rawConfig));

  return {
    ...config,
    ignorePaths: uniqueStrings([...config.ignorePaths, config.artifactDir]),
  };
}
