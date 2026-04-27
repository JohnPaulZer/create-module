import path from "node:path";
import fs from "fs-extra";
import type { PlanItem, ResolvedPlanItem, WriteResult } from "../types.js";

const resolveStatus = async (
  item: PlanItem,
  overwriteFiles: boolean,
): Promise<ResolvedPlanItem["status"]> => {
  const exists = await fs.pathExists(item.targetPath);

  if (!exists) {
    return "create";
  }

  const stat = await fs.stat(item.targetPath);

  if (item.operation === "directory") {
    return stat.isDirectory() ? "exists" : "conflict";
  }

  if (stat.isDirectory()) {
    return "conflict";
  }

  return overwriteFiles ? "overwrite" : "exists";
};

export const resolvePlan = async (
  cwd: string,
  plan: PlanItem[],
  overwriteFiles: boolean,
): Promise<ResolvedPlanItem[]> =>
  Promise.all(
    plan.map(async (item) => ({
      ...item,
      status: await resolveStatus(item, overwriteFiles),
      relativePath: path.relative(cwd, item.targetPath) || ".",
    })),
  );

export const writePlan = async (
  plan: ResolvedPlanItem[],
): Promise<WriteResult[]> => {
  const results: WriteResult[] = [];

  for (const item of plan) {
    try {
      if (item.status === "conflict") {
        results.push({
          item,
          action: "failed",
          error: "A file exists where a directory is needed.",
        });
        continue;
      }

      if (item.operation === "directory") {
        if (item.status === "create") {
          await fs.ensureDir(item.targetPath);
          results.push({ item, action: "created" });
        } else {
          results.push({ item, action: "skipped" });
        }

        continue;
      }

      if (item.operation === "copy" || item.operation === "move") {
        if (!item.sourcePath) {
          results.push({
            item,
            action: "failed",
            error: "Missing source path.",
          });
          continue;
        }

        if (!(await fs.pathExists(item.sourcePath))) {
          results.push({
            item,
            action: "failed",
            error: "Source file does not exist.",
          });
          continue;
        }

        if (item.status === "exists") {
          results.push({ item, action: "skipped" });
          continue;
        }

        await fs.ensureDir(path.dirname(item.targetPath));

        if (item.operation === "copy") {
          await fs.copy(item.sourcePath, item.targetPath, {
            overwrite: item.status === "overwrite",
            errorOnExist: false,
          });
          results.push({
            item,
            action: item.status === "overwrite" ? "overwritten" : "copied",
          });
        } else {
          await fs.move(item.sourcePath, item.targetPath, {
            overwrite: item.status === "overwrite",
          });
          results.push({
            item,
            action: item.status === "overwrite" ? "overwritten" : "moved",
          });
        }

        continue;
      }

      if (item.status === "exists") {
        results.push({ item, action: "skipped" });
        continue;
      }

      await fs.ensureDir(path.dirname(item.targetPath));
      await fs.outputFile(item.targetPath, item.content ?? "", "utf8");
      results.push({
        item,
        action: item.status === "overwrite" ? "overwritten" : "created",
      });
    } catch (error) {
      results.push({
        item,
        action: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
};
