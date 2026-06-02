import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { formatJsonReport } from "./jsonReporter.ts";
import type { AgentDoctorReport } from "../types.ts";

export async function writeArtifacts(
  projectRoot: string,
  artifactDir: string,
  report: AgentDoctorReport,
  codexSummary: string,
): Promise<{ reportPath: string; summaryPath: string }> {
  const resolvedArtifactDirectory = path.resolve(projectRoot, artifactDir);
  const reportPath = path.join(resolvedArtifactDirectory, "report.json");
  const summaryPath = path.join(resolvedArtifactDirectory, "summary.md");

  await mkdir(resolvedArtifactDirectory, { recursive: true });
  await writeFile(reportPath, formatJsonReport(report), "utf8");
  await writeFile(summaryPath, codexSummary, "utf8");

  return { reportPath, summaryPath };
}
