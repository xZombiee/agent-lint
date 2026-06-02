import type { AgentDoctorReport } from "../types.ts";

export function formatJsonReport(report: AgentDoctorReport): string {
  return JSON.stringify(report, null, 2);
}
