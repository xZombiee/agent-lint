import type { AgentLintIssue, RuntimeFact, RuntimeMention, ScanContext } from "../types.ts";

function extractMajorVersion(value: string): string | null {
  return /v?(?<major>\d+)/iu.exec(value.replace(/^[<>=~^\s]+/u, ""))?.groups?.major ?? null;
}

function extractComparator(value: string): string {
  return /^(?<comparator>>=|>|<=|<|=|\^|~)/u.exec(value.trim())?.groups?.comparator ?? "";
}

function formatRuntimeFacts(facts: RuntimeFact[]): string {
  return facts.map((fact) => `${fact.source} ${fact.version}`).join(", ");
}

function factAllowsMentionedMajor(fact: RuntimeFact, mentionedMajor: number): boolean {
  const factMajor = extractMajorVersion(fact.version);

  if (!factMajor) {
    return true;
  }

  const parsedFactMajor = Number(factMajor);

  if (!Number.isFinite(parsedFactMajor)) {
    return true;
  }

  const comparator = extractComparator(fact.version);

  if (comparator === ">=" || comparator === ">") {
    return mentionedMajor >= parsedFactMajor;
  }

  if (comparator === "<=" || comparator === "<") {
    return mentionedMajor <= parsedFactMajor;
  }

  return mentionedMajor === parsedFactMajor;
}

function hasMatchingRuntimeMajor(mention: RuntimeMention, facts: RuntimeFact[]): boolean {
  const mentionedMajor = extractMajorVersion(mention.version);

  if (!mentionedMajor) {
    return true;
  }

  const parsedMentionedMajor = Number(mentionedMajor);

  if (!Number.isFinite(parsedMentionedMajor)) {
    return true;
  }

  return facts.some((fact) => factAllowsMentionedMajor(fact, parsedMentionedMajor));
}

export function runtimeMismatch(context: ScanContext): AgentLintIssue[] {
  const issues: AgentLintIssue[] = [];

  for (const instructionFile of context.instructionFiles) {
    for (const mention of instructionFile.runtimeMentions) {
      const facts = context.repoFacts.runtimes[mention.runtime] ?? [];

      if (facts.length === 0 || hasMatchingRuntimeMajor(mention, facts)) {
        continue;
      }

      issues.push({
        id: `runtime-mismatch:${instructionFile.path}:${mention.line}:${mention.runtime}`,
        rule: "runtimeMismatch",
        severity: "warning",
        sourceFile: instructionFile.path,
        line: mention.line,
        message: "Runtime version mismatch",
        evidence: {
          instructionText: mention.instructionText,
          repoFact: `Repository runtime metadata says ${formatRuntimeFacts(facts)}, but the instruction mentions ${mention.runtime} ${mention.version}.`,
        },
        suggestion: `Update the instruction to match the repository ${mention.runtime} version metadata, or update the runtime metadata if the instruction is authoritative.`,
        suggestions: facts.map((fact) => fact.version),
      });
    }
  }

  return issues;
}
