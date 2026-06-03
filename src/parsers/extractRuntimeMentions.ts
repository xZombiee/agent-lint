import type { RuntimeMention, RuntimeName } from "../types.ts";

const RUNTIME_PATTERN =
  /\b(?<runtime>Node(?:\.js)?|Python|Java)\s*(?:version\s*)?(?<version>>=?|<=?|=|~|\^)?\s*v?(?<number>\d+(?:\.\d+){0,2}(?:\.x)?)/giu;

function normalizeRuntime(value: string): RuntimeName {
  const normalized = value.toLowerCase();

  if (normalized.startsWith("node")) {
    return "node";
  }

  if (normalized === "python") {
    return "python";
  }

  return "java";
}

export function extractRuntimeMentions(content: string): RuntimeMention[] {
  const mentions: RuntimeMention[] = [];
  const lines = content.split(/\r?\n/u);

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      return;
    }

    for (const match of line.matchAll(RUNTIME_PATTERN)) {
      const runtime = match.groups?.runtime;
      const number = match.groups?.number;
      const operator = match.groups?.version ?? "";

      if (!runtime || !number) {
        continue;
      }

      mentions.push({
        runtime: normalizeRuntime(runtime),
        version: `${operator}${number}`,
        line: index + 1,
        instructionText: trimmedLine,
      });
    }
  });

  return mentions;
}
