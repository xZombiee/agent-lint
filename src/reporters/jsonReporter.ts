import type { AgentLintReport } from "../types.ts";

export function formatJsonReport(report: AgentLintReport): string {
  return JSON.stringify(report, null, 2);
}
