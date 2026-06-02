import { defaultConfig } from "./defaultConfig.ts";
import type {
  AgentDoctorConfig,
  IssueSeverity,
  ResolvedAgentDoctorConfig,
  RuleName,
} from "../types.ts";

const RULE_NAMES: RuleName[] = [
  "brokenFileReferences",
  "missingPackageScripts",
  "toolMismatch",
  "explicitContradictions",
];

const VALID_SEVERITIES: IssueSeverity[] = ["info", "warning", "error"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid "${fieldName}" value in agent-doctor config.`);
  }

  return value;
}

export function parseConfigObject(rawConfig: unknown): AgentDoctorConfig {
  if (!isPlainObject(rawConfig)) {
    throw new Error("Agent Doctor config must be a JSON object.");
  }

  const allowedTopLevelKeys = new Set([
    "instructionFiles",
    "ignorePaths",
    "artifactDir",
    "rules",
    "severity",
  ]);

  for (const key of Object.keys(rawConfig)) {
    if (!allowedTopLevelKeys.has(key)) {
      throw new Error(`Unknown config field "${key}" in agent-doctor config.`);
    }
  }

  const parsedConfig: AgentDoctorConfig = {};

  if ("instructionFiles" in rawConfig) {
    parsedConfig.instructionFiles = expectStringArray(
      rawConfig.instructionFiles,
      "instructionFiles",
    );
  }

  if ("ignorePaths" in rawConfig) {
    parsedConfig.ignorePaths = expectStringArray(rawConfig.ignorePaths, "ignorePaths");
  }

  if ("artifactDir" in rawConfig) {
    if (typeof rawConfig.artifactDir !== "string") {
      throw new Error('Invalid "artifactDir" value in agent-doctor config.');
    }

    parsedConfig.artifactDir = rawConfig.artifactDir;
  }

  if ("rules" in rawConfig) {
    if (!isPlainObject(rawConfig.rules)) {
      throw new Error('Invalid "rules" value in agent-doctor config.');
    }

    parsedConfig.rules = {};

    for (const [key, value] of Object.entries(rawConfig.rules)) {
      if (!RULE_NAMES.includes(key as RuleName)) {
        throw new Error(`Unknown rule "${key}" in agent-doctor config.`);
      }

      if (typeof value !== "boolean") {
        throw new Error(`Invalid rule toggle for "${key}" in agent-doctor config.`);
      }

      parsedConfig.rules[key as RuleName] = value;
    }
  }

  if ("severity" in rawConfig) {
    if (!isPlainObject(rawConfig.severity)) {
      throw new Error('Invalid "severity" value in agent-doctor config.');
    }

    parsedConfig.severity = {};

    for (const [key, value] of Object.entries(rawConfig.severity)) {
      if (!RULE_NAMES.includes(key as RuleName)) {
        throw new Error(`Unknown severity override "${key}" in agent-doctor config.`);
      }

      if (typeof value !== "string" || !VALID_SEVERITIES.includes(value as IssueSeverity)) {
        throw new Error(`Invalid severity "${value}" for "${key}" in agent-doctor config.`);
      }

      parsedConfig.severity[key as RuleName] = value as IssueSeverity;
    }
  }

  return parsedConfig;
}

export function resolveConfig(config: AgentDoctorConfig = {}): ResolvedAgentDoctorConfig {
  return {
    instructionFiles: config.instructionFiles ?? [...defaultConfig.instructionFiles],
    ignorePaths: config.ignorePaths ?? [...defaultConfig.ignorePaths],
    artifactDir: config.artifactDir ?? defaultConfig.artifactDir,
    rules: {
      ...defaultConfig.rules,
      ...config.rules,
    },
    severity: {
      ...defaultConfig.severity,
      ...config.severity,
    },
  };
}
