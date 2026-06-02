import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseConfigObject, resolveConfig } from "./configSchema.js";
import { pathExists } from "../utils/pathExists.js";
const DEFAULT_CONFIG_NAME = "agent-lint.config.json";
function uniqueStrings(values) {
    return [...new Set(values)];
}
export async function loadConfig(projectRoot, explicitConfigPath) {
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
    const rawConfig = JSON.parse(rawFile);
    const config = resolveConfig(parseConfigObject(rawConfig));
    return {
        ...config,
        ignorePaths: uniqueStrings([...config.ignorePaths, config.artifactDir]),
    };
}
//# sourceMappingURL=loadConfig.js.map