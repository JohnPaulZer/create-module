import path from "node:path";
import fs from "fs-extra";
import type { WriteResult } from "../types.js";

export interface CleanupEmptyFoldersResult {
  removedFolders: number;
}

const legacyFolderNames = new Set(["modules", "features"]);

const toKey = (targetPath: string): string => path.normalize(path.resolve(targetPath));

const isInsideLegacyFolder = (cwd: string, targetPath: string): boolean => {
  const segments = path.relative(cwd, targetPath).split(path.sep);

  return segments.some((segment) => legacyFolderNames.has(segment));
};

const isWithinCwd = (cwd: string, targetPath: string): boolean => {
  const relativePath = path.relative(cwd, targetPath);

  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
};

const removeIfEmpty = async (targetPath: string): Promise<boolean> => {
  try {
    const entries = await fs.readdir(targetPath);

    if (entries.length > 0) {
      return false;
    }

    await fs.rmdir(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const cleanupEmptyMovedSourceFolders = async (
  cwd: string,
  results: WriteResult[],
): Promise<CleanupEmptyFoldersResult> => {
  const candidateFolders = new Set<string>();

  for (const result of results) {
    if (result.action !== "moved" || !result.item.sourcePath) {
      continue;
    }

    let currentFolder = toKey(path.dirname(result.item.sourcePath));

    while (
      isWithinCwd(cwd, currentFolder) &&
      isInsideLegacyFolder(cwd, currentFolder)
    ) {
      candidateFolders.add(currentFolder);
      currentFolder = path.dirname(currentFolder);
    }
  }

  const folders = [...candidateFolders].sort((left, right) => right.length - left.length);
  let removedFolders = 0;

  for (const folder of folders) {
    if (await removeIfEmpty(folder)) {
      removedFolders += 1;
    }
  }

  return { removedFolders };
};
