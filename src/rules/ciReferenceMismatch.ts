import type { AgentLintIssue, CiMention, ScanContext } from "../types.ts";

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, "-");
}

function hasNameMatch(name: string, candidates: string[]): boolean {
  const normalizedName = normalizeName(name);

  return candidates.some((candidate) => normalizeName(candidate) === normalizedName);
}

function providerLabel(mention: CiMention): string {
  switch (mention.provider) {
    case "github-actions":
      return "GitHub Actions";
    case "circleci":
      return "CircleCI";
    case "gitlab-ci":
      return "GitLab CI";
    case "vercel":
      return "Vercel";
    case "netlify":
      return "Netlify";
  }
}

export function ciReferenceMismatch(context: ScanContext): AgentLintIssue[] {
  const issues: AgentLintIssue[] = [];
  const seenProviderIssues = new Set<string>();

  for (const instructionFile of context.instructionFiles) {
    for (const mention of instructionFile.ciMentions) {
      const providerIsConfigured = context.repoFacts.ci.providers.includes(mention.provider);

      if (!providerIsConfigured && mention.kind === "provider") {
        const key = `${instructionFile.path}:${mention.line}:${mention.provider}`;

        if (seenProviderIssues.has(key)) {
          continue;
        }

        seenProviderIssues.add(key);
        issues.push({
          id: `ci-reference-mismatch:provider:${instructionFile.path}:${mention.line}:${mention.provider}`,
          rule: "ciReferenceMismatch",
          severity: mention.provider === "github-actions" ? "warning" : "info",
          sourceFile: instructionFile.path,
          line: mention.line,
          message: "CI provider not configured",
          evidence: {
            instructionText: mention.instructionText,
            repoFact: `No ${providerLabel(mention)} configuration file was found in the repository.`,
          },
          suggestion: `Add ${providerLabel(mention)} configuration or update the instruction.`,
        });
        continue;
      }

      if (!providerIsConfigured || mention.provider !== "github-actions" || !mention.name) {
        continue;
      }

      if (
        mention.kind === "workflow" &&
        !hasNameMatch(mention.name, context.repoFacts.ci.githubWorkflowNames)
      ) {
        issues.push({
          id: `ci-reference-mismatch:workflow:${instructionFile.path}:${mention.line}:${mention.name}`,
          rule: "ciReferenceMismatch",
          severity: "warning",
          sourceFile: instructionFile.path,
          line: mention.line,
          message: "Missing GitHub Actions workflow",
          evidence: {
            instructionText: mention.instructionText,
            repoFact: `No GitHub Actions workflow named "${mention.name}" was found. Known workflows: ${context.repoFacts.ci.githubWorkflowNames.join(", ") || "none"}.`,
          },
          suggestion: "Update the workflow name in the instruction or add the missing workflow.",
          suggestions: context.repoFacts.ci.githubWorkflowNames,
        });
      }

      if (
        mention.kind === "job" &&
        !hasNameMatch(mention.name, context.repoFacts.ci.githubJobIds)
      ) {
        issues.push({
          id: `ci-reference-mismatch:job:${instructionFile.path}:${mention.line}:${mention.name}`,
          rule: "ciReferenceMismatch",
          severity: "warning",
          sourceFile: instructionFile.path,
          line: mention.line,
          message: "Missing GitHub Actions job",
          evidence: {
            instructionText: mention.instructionText,
            repoFact: `No GitHub Actions job named "${mention.name}" was found. Known jobs: ${context.repoFacts.ci.githubJobIds.join(", ") || "none"}.`,
          },
          suggestion: "Update the job name in the instruction or add the missing job.",
          suggestions: context.repoFacts.ci.githubJobIds,
        });
      }
    }
  }

  return issues;
}
