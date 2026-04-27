import path from "node:path";
import fs from "fs-extra";
import type { ProjectType, WriteResult } from "../types.js";

interface ReportOptions {
  cwd: string;
  projectType: ProjectType;
  modules: string[];
  includeStarterFiles: boolean;
  dryRun: boolean;
  overwriteFiles: boolean;
  results: WriteResult[];
}

const reportName = "moducreate-jpz-report.md";

const timestamp = (): string =>
  new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);

const getReportPath = async (cwd: string): Promise<string> => {
  const defaultPath = path.join(cwd, reportName);

  if (!(await fs.pathExists(defaultPath))) {
    return defaultPath;
  }

  return path.join(cwd, `moducreate-jpz-report-${timestamp()}.md`);
};

export const createReport = async (
  options: ReportOptions,
): Promise<string | undefined> => {
  if (options.dryRun) {
    return undefined;
  }

  const created = options.results.filter((result) => result.action === "created");
  const copied = options.results.filter((result) => result.action === "copied");
  const moved = options.results.filter((result) => result.action === "moved");
  const skipped = options.results.filter((result) => result.action === "skipped");
  const overwritten = options.results.filter(
    (result) => result.action === "overwritten",
  );
  const failed = options.results.filter((result) => result.action === "failed");

  const lines = [
    "# moducreate-jpz Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Project type: ${options.projectType}`,
    `Modules: ${options.modules.join(", ")}`,
    `Starter files: ${options.includeStarterFiles ? "yes" : "no"}`,
    `Overwrite files: ${options.overwriteFiles ? "yes" : "no"}`,
    "",
    "## Summary",
    "",
    `- Created: ${created.length}`,
    `- Copied: ${copied.length}`,
    `- Moved: ${moved.length}`,
    `- Skipped: ${skipped.length}`,
    `- Overwritten: ${overwritten.length}`,
    `- Failed: ${failed.length}`,
    "",
    "## Files And Folders",
    "",
    ...options.results.map((result) => {
      const suffix = result.error ? ` - ${result.error}` : "";
      return `- ${result.action.toUpperCase()}: ${result.item.relativePath}${suffix}`;
    }),
    "",
  ];

  const targetPath = await getReportPath(options.cwd);
  await fs.outputFile(targetPath, lines.join("\n"), "utf8");

  return targetPath;
};
