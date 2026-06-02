import type {
  PackageJsonData,
  SupportedToolKey,
  ToolDefinition,
} from "../types.ts";

export const SUPPORTED_TOOLS: ToolDefinition[] = [
  {
    key: "jest",
    name: "Jest",
    packages: ["jest", "@jest/globals", "ts-jest"],
    category: "testRunner",
  },
  {
    key: "vitest",
    name: "Vitest",
    packages: ["vitest"],
    category: "testRunner",
  },
  {
    key: "playwright",
    name: "Playwright",
    packages: ["playwright", "@playwright/test"],
    category: "e2e",
  },
  {
    key: "cypress",
    name: "Cypress",
    packages: ["cypress"],
    category: "e2e",
  },
  {
    key: "redux",
    name: "Redux",
    packages: ["redux", "@reduxjs/toolkit", "react-redux"],
    category: "state",
  },
  {
    key: "zustand",
    name: "Zustand",
    packages: ["zustand"],
    category: "state",
  },
  {
    key: "eslint",
    name: "ESLint",
    packages: ["eslint"],
    category: "lint",
  },
  {
    key: "prettier",
    name: "Prettier",
    packages: ["prettier"],
    category: "format",
  },
  {
    key: "tailwind",
    name: "Tailwind",
    packages: ["tailwindcss"],
    category: "styling",
  },
  {
    key: "prisma",
    name: "Prisma",
    packages: ["prisma", "@prisma/client"],
    category: "orm",
  },
  {
    key: "drizzle",
    name: "Drizzle",
    packages: ["drizzle-orm", "drizzle-kit"],
    category: "orm",
  },
  {
    key: "nextjs",
    name: "Next.js",
    packages: ["next"],
    category: "app",
  },
  {
    key: "vite",
    name: "Vite",
    packages: ["vite"],
    category: "app",
  },
];

const TOOL_MAP = new Map(SUPPORTED_TOOLS.map((tool) => [tool.key, tool]));

export function getToolDefinition(toolKey: SupportedToolKey): ToolDefinition {
  const tool = TOOL_MAP.get(toolKey);

  if (!tool) {
    throw new Error(`Unsupported tool key: ${toolKey}`);
  }

  return tool;
}

export function getInstalledToolKeys(packageJson: PackageJsonData | null): Set<SupportedToolKey> {
  const packageNames = new Set<string>([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ]);

  return new Set(
    SUPPORTED_TOOLS.filter((tool) => tool.packages.some((packageName) => packageNames.has(packageName)))
      .map((tool) => tool.key),
  );
}

export function getInstalledPackagesForTool(
  packageJson: PackageJsonData | null,
  toolKey: SupportedToolKey,
): string[] {
  const packageNames = new Set<string>([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
  ]);

  return getToolDefinition(toolKey).packages.filter((packageName) => packageNames.has(packageName));
}

export function getAlternativeTools(toolKey: SupportedToolKey): ToolDefinition[] {
  const tool = getToolDefinition(toolKey);

  return SUPPORTED_TOOLS.filter(
    (candidate) => candidate.category === tool.category && candidate.key !== toolKey,
  );
}
