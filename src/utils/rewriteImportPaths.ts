import fg from "fast-glob";
import fs from "fs-extra";
import path from "node:path";
import type { ResolvedPlanItem, WriteResult } from "../types.js";

export interface RewriteChange {
  filePath: string;
  originalFilePath: string;
  from: string;
  to: string;
}

export interface ImportRewriteResult {
  filesUpdated: number;
  specifiersUpdated: number;
  relocatedFiles: number;
  changes: RewriteChange[];
}

interface AliasEntry {
  specifierPrefix: string;
  targetPrefix: string;
  wildcard: boolean;
}

interface RelocationMaps {
  originalPathsByCurrent: Map<string, string>;
  relocatedTargetsBySource: Map<string, string>;
}

type RewriteMode = "apply" | "preview";

const rewriteFilePatterns = ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,vue}"];
const rewriteIgnores = [
  "node_modules/**",
  "dist/**",
  "build/**",
  "coverage/**",
  "vendor/**",
  ".git/**",
];
const configFilePatterns = [
  "tsconfig.json",
  "jsconfig.json",
  "*/tsconfig.json",
  "*/jsconfig.json",
];
const viteConfigPatterns = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
  "*/vite.config.ts",
  "*/vite.config.js",
  "*/vite.config.mts",
  "*/vite.config.mjs",
];
const knownExtensions = [
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".mts",
  ".mjs",
  ".cts",
  ".cjs",
  ".vue",
  ".json",
  ".scss",
  ".sass",
  ".less",
  ".css",
];
const importRegexes = [
  /(\bimport\s+(?:type\s+)?(?:[^'"]+?\s+from\s*)?)(["'])([^"']+)\2/g,
  /(\bexport\s+(?:type\s+)?[^'"]*?\s+from\s*)(["'])([^"']+)\2/g,
  /(\b(?:require|import)\s*\(\s*)(["'])([^"']+)\2/g,
];
const successfulRelocationActions = new Set(["copied", "moved", "overwritten"]);

const toKey = (targetPath: string): string =>
  path.normalize(path.resolve(targetPath));

const isRelativeSpecifier = (specifier: string): boolean =>
  specifier.startsWith("./") || specifier.startsWith("../");

const splitSpecifier = (
  specifier: string,
): { pathPart: string; suffix: string } => {
  const match = specifier.match(/^([^?#]+)([?#].*)?$/);

  return {
    pathPart: match?.[1] ?? specifier,
    suffix: match?.[2] ?? "",
  };
};

const getKnownExtension = (value: string): string | undefined => {
  const lowerValue = value.toLowerCase();

  return knownExtensions.find((extension) => lowerValue.endsWith(extension));
};

const stripKnownExtension = (value: string): string => {
  const extension = getKnownExtension(value);

  return extension ? value.slice(0, -extension.length) : value;
};

const getExtensionCandidates = (
  specifierExtension: string | undefined,
): string[] => {
  if (specifierExtension === ".js") {
    return [".js", ".ts", ".tsx", ".mjs", ".mts"];
  }

  if (specifierExtension === ".jsx") {
    return [".jsx", ".tsx"];
  }

  if (specifierExtension === ".mjs") {
    return [".mjs", ".mts", ".js", ".ts"];
  }

  if (specifierExtension === ".cjs") {
    return [".cjs", ".cts", ".js", ".ts"];
  }

  if (specifierExtension) {
    return [specifierExtension];
  }

  return knownExtensions;
};

const getCandidatePaths = (
  rawTargetPath: string,
  specifierExtension: string | undefined,
): string[] => {
  const extensionCandidates = getExtensionCandidates(specifierExtension);
  const candidates = new Set<string>([rawTargetPath]);

  if (specifierExtension) {
    const withoutExtension = rawTargetPath.slice(0, -specifierExtension.length);

    extensionCandidates.forEach((extension) => {
      candidates.add(`${withoutExtension}${extension}`);
    });
  } else {
    extensionCandidates.forEach((extension) => {
      candidates.add(`${rawTargetPath}${extension}`);
      candidates.add(path.join(rawTargetPath, `index${extension}`));
    });
  }

  return [...candidates];
};

const normalizeConfigTarget = (configDir: string, target: string): string => {
  const normalizedTarget = target.replace(/\*.*$/, "").replace(/\/$/, "");

  return toKey(path.resolve(configDir, normalizedTarget || "."));
};

const normalizeSpecifierPrefix = (
  value: string,
): { prefix: string; wildcard: boolean } => {
  const wildcard = value.includes("*");
  const prefix = value.replace(/\*.*$/, "").replace(/\/$/, "");

  return {
    prefix,
    wildcard,
  };
};

const loadTsConfigAliases = async (cwd: string): Promise<AliasEntry[]> => {
  const configFiles = await fg(configFilePatterns, {
    cwd,
    ignore: rewriteIgnores,
    onlyFiles: true,
  });
  const aliases: AliasEntry[] = [];

  for (const configFile of configFiles) {
    try {
      const configPath = path.join(cwd, configFile);
      const configDir = path.dirname(configPath);
      const config = (await fs.readJson(configPath)) as {
        compilerOptions?: {
          baseUrl?: string;
          paths?: Record<string, string[]>;
        };
      };
      const baseUrl = path.resolve(
        configDir,
        config.compilerOptions?.baseUrl ?? ".",
      );
      const paths = config.compilerOptions?.paths ?? {};

      for (const [specifier, targets] of Object.entries(paths)) {
        const target = targets[0];

        if (!target) {
          continue;
        }

        const specifierPattern = normalizeSpecifierPrefix(specifier);
        aliases.push({
          specifierPrefix: specifierPattern.prefix,
          targetPrefix: normalizeConfigTarget(baseUrl, target),
          wildcard: specifierPattern.wildcard,
        });
      }
    } catch {
      // Ignore config files this lightweight parser cannot read.
    }
  }

  return aliases;
};

const loadViteAliases = async (cwd: string): Promise<AliasEntry[]> => {
  const configFiles = await fg(viteConfigPatterns, {
    cwd,
    ignore: rewriteIgnores,
    onlyFiles: true,
  });
  const aliases: AliasEntry[] = [];

  for (const configFile of configFiles) {
    const configPath = path.join(cwd, configFile);
    const configDir = path.dirname(configPath);
    const content = await fs.readFile(configPath, "utf8");
    const objectAliasRegex =
      /["']([^"']+)["']\s*:\s*(?:path\.resolve\([^,]+,\s*)?["']([^"']+)["']\)?/g;
    const findReplacementRegex =
      /find\s*:\s*["']([^"']+)["'][\s\S]{0,120}?replacement\s*:\s*(?:path\.resolve\([^,]+,\s*)?["']([^"']+)["']\)?/g;

    for (const match of content.matchAll(objectAliasRegex)) {
      const specifierPrefix = match[1];
      const targetPrefix = match[2];

      if (!specifierPrefix || !targetPrefix) {
        continue;
      }

      aliases.push({
        specifierPrefix,
        targetPrefix: normalizeConfigTarget(configDir, targetPrefix),
        wildcard: true,
      });
    }

    for (const match of content.matchAll(findReplacementRegex)) {
      const specifierPrefix = match[1];
      const targetPrefix = match[2];

      if (!specifierPrefix || !targetPrefix) {
        continue;
      }

      aliases.push({
        specifierPrefix,
        targetPrefix: normalizeConfigTarget(configDir, targetPrefix),
        wildcard: true,
      });
    }
  }

  return aliases;
};

const loadAliases = async (cwd: string): Promise<AliasEntry[]> => {
  const aliases = [
    ...(await loadTsConfigAliases(cwd)),
    ...(await loadViteAliases(cwd)),
  ];
  const seen = new Set<string>();

  return aliases
    .filter((alias) => {
      const key = `${alias.specifierPrefix}:${alias.targetPrefix}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        right.specifierPrefix.length - left.specifierPrefix.length,
    );
};

const resolveAliasTarget = (
  specifier: string,
  aliases: AliasEntry[],
): { targetPath: string; alias: AliasEntry } | undefined => {
  for (const alias of aliases) {
    if (specifier === alias.specifierPrefix) {
      return {
        targetPath: alias.targetPrefix,
        alias,
      };
    }

    const separator = alias.specifierPrefix.endsWith("/") ? "" : "/";

    if (specifier.startsWith(`${alias.specifierPrefix}${separator}`)) {
      return {
        targetPath: path.join(
          alias.targetPrefix,
          specifier.slice(`${alias.specifierPrefix}${separator}`.length),
        ),
        alias,
      };
    }
  }

  return undefined;
};

const resolveExistingTarget = async (
  rawTargetPath: string,
  specifierExtension: string | undefined,
  relocatedTargetsBySource: Map<string, string>,
): Promise<string | undefined> => {
  for (const candidate of getCandidatePaths(
    rawTargetPath,
    specifierExtension,
  )) {
    const key = toKey(candidate);

    if (relocatedTargetsBySource.has(key)) {
      return key;
    }

    if (await fs.pathExists(candidate)) {
      return key;
    }
  }

  return undefined;
};

const toRelativeSpecifier = (
  importerPath: string,
  targetPath: string,
  originalSpecifierExtension: string | undefined,
  suffix: string,
): string => {
  const outputTarget = originalSpecifierExtension
    ? `${stripKnownExtension(targetPath)}${originalSpecifierExtension}`
    : stripKnownExtension(targetPath);
  let relativePath = path
    .relative(path.dirname(importerPath), outputTarget)
    .split(path.sep)
    .join("/");

  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  return `${relativePath}${suffix}`;
};

const toAliasSpecifier = (
  targetPath: string,
  originalSpecifierExtension: string | undefined,
  suffix: string,
  aliases: AliasEntry[],
  preferredAlias?: AliasEntry,
): string | undefined => {
  const sortedAliases = preferredAlias
    ? [preferredAlias, ...aliases.filter((alias) => alias !== preferredAlias)]
    : aliases;

  for (const alias of sortedAliases) {
    const relativeTarget = path.relative(alias.targetPrefix, targetPath);

    if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
      continue;
    }

    const outputTarget = originalSpecifierExtension
      ? `${stripKnownExtension(relativeTarget)}${originalSpecifierExtension}`
      : stripKnownExtension(relativeTarget);
    const normalizedTarget = outputTarget.split(path.sep).join("/");

    if (normalizedTarget === "") {
      return `${alias.specifierPrefix}${suffix}`;
    }

    const separator = alias.specifierPrefix.endsWith("/") ? "" : "/";

    return `${alias.specifierPrefix}${separator}${normalizedTarget}${suffix}`;
  }

  return undefined;
};

const rewriteSpecifier = async (
  specifier: string,
  currentImporterPath: string,
  originalImporterPath: string,
  relocatedTargetsBySource: Map<string, string>,
  aliases: AliasEntry[],
): Promise<string> => {
  const { pathPart, suffix } = splitSpecifier(specifier);
  const specifierExtension = getKnownExtension(pathPart);
  const aliasTarget = isRelativeSpecifier(specifier)
    ? undefined
    : resolveAliasTarget(pathPart, aliases);
  const rawTargetPath = isRelativeSpecifier(specifier)
    ? path.resolve(path.dirname(originalImporterPath), pathPart)
    : aliasTarget?.targetPath;

  if (!rawTargetPath) {
    return specifier;
  }

  const resolvedTargetPath = await resolveExistingTarget(
    rawTargetPath,
    specifierExtension,
    relocatedTargetsBySource,
  );

  if (!resolvedTargetPath) {
    return specifier;
  }

  const relocatedTargetPath =
    relocatedTargetsBySource.get(toKey(resolvedTargetPath)) ??
    resolvedTargetPath;

  if (aliasTarget) {
    return (
      toAliasSpecifier(
        relocatedTargetPath,
        specifierExtension,
        suffix,
        aliases,
        aliasTarget.alias,
      ) ?? specifier
    );
  }

  return toRelativeSpecifier(
    currentImporterPath,
    relocatedTargetPath,
    specifierExtension,
    suffix,
  );
};

const rewriteContent = async (
  content: string,
  currentImporterPath: string,
  originalImporterPath: string,
  relocatedTargetsBySource: Map<string, string>,
  aliases: AliasEntry[],
): Promise<{ content: string; changes: RewriteChange[] }> => {
  let updatedContent = content;
  const changes: RewriteChange[] = [];

  for (const regex of importRegexes) {
    const matches = [...updatedContent.matchAll(regex)];

    if (matches.length === 0) {
      continue;
    }

    let nextContent = "";
    let lastIndex = 0;

    for (const match of matches) {
      const fullMatch = match[0];
      const prefix = match[1];
      const quote = match[2];
      const specifier = match[3];
      const index = match.index ?? 0;

      if (!fullMatch || !prefix || !quote || !specifier) {
        continue;
      }
      const rewrittenSpecifier = await rewriteSpecifier(
        specifier,
        currentImporterPath,
        originalImporterPath,
        relocatedTargetsBySource,
        aliases,
      );

      nextContent += updatedContent.slice(lastIndex, index);
      nextContent += `${prefix}${quote}${rewrittenSpecifier}${quote}`;
      lastIndex = index + fullMatch.length;

      if (rewrittenSpecifier !== specifier) {
        changes.push({
          filePath: currentImporterPath,
          originalFilePath: originalImporterPath,
          from: specifier,
          to: rewrittenSpecifier,
        });
      }
    }

    nextContent += updatedContent.slice(lastIndex);
    updatedContent = nextContent;
  }

  return {
    content: updatedContent,
    changes,
  };
};

const getRelocationMapsFromResults = (
  results: WriteResult[],
): RelocationMaps => {
  const originalPathsByCurrent = new Map<string, string>();
  const relocatedTargetsBySource = new Map<string, string>();

  for (const result of results) {
    if (
      !successfulRelocationActions.has(result.action) ||
      (result.item.operation !== "copy" && result.item.operation !== "move") ||
      !result.item.sourcePath
    ) {
      continue;
    }

    const sourcePath = toKey(result.item.sourcePath);
    const targetPath = toKey(result.item.targetPath);

    originalPathsByCurrent.set(targetPath, sourcePath);
    relocatedTargetsBySource.set(sourcePath, targetPath);
  }

  return {
    originalPathsByCurrent,
    relocatedTargetsBySource,
  };
};

const getRelocationMapsFromPlan = (
  plan: ResolvedPlanItem[],
): RelocationMaps => {
  const originalPathsByCurrent = new Map<string, string>();
  const relocatedTargetsBySource = new Map<string, string>();

  for (const item of plan) {
    if (
      (item.operation !== "copy" && item.operation !== "move") ||
      !item.sourcePath ||
      item.status === "exists" ||
      item.status === "conflict"
    ) {
      continue;
    }

    const sourcePath = toKey(item.sourcePath);
    const targetPath = toKey(item.targetPath);

    originalPathsByCurrent.set(targetPath, sourcePath);
    relocatedTargetsBySource.set(sourcePath, targetPath);
  }

  return {
    originalPathsByCurrent,
    relocatedTargetsBySource,
  };
};

const collectImportPathRewrites = async (
  cwd: string,
  maps: RelocationMaps,
  mode: RewriteMode,
): Promise<ImportRewriteResult> => {
  const { originalPathsByCurrent, relocatedTargetsBySource } = maps;

  if (relocatedTargetsBySource.size === 0) {
    return {
      filesUpdated: 0,
      specifiersUpdated: 0,
      relocatedFiles: 0,
      changes: [],
    };
  }

  const aliases = await loadAliases(cwd);
  const files = await fg(rewriteFilePatterns, {
    cwd,
    ignore: rewriteIgnores,
    onlyFiles: true,
  });
  const changes: RewriteChange[] = [];
  let filesUpdated = 0;

  for (const file of files) {
    const filePath = toKey(path.join(cwd, file));
    const originalFilePath =
      mode === "apply"
        ? (originalPathsByCurrent.get(filePath) ?? filePath)
        : filePath;
    const currentFilePath =
      mode === "apply"
        ? filePath
        : (relocatedTargetsBySource.get(filePath) ?? filePath);
    const content = await fs.readFile(filePath, "utf8");
    const rewritten = await rewriteContent(
      content,
      currentFilePath,
      originalFilePath,
      relocatedTargetsBySource,
      aliases,
    );

    if (rewritten.changes.length === 0) {
      continue;
    }

    changes.push(...rewritten.changes);
    filesUpdated += 1;

    if (mode === "apply") {
      await fs.writeFile(filePath, rewritten.content, "utf8");
    }
  }

  return {
    filesUpdated,
    specifiersUpdated: changes.length,
    relocatedFiles: relocatedTargetsBySource.size,
    changes,
  };
};

export const previewImportPathRewrites = async (
  cwd: string,
  plan: ResolvedPlanItem[],
): Promise<ImportRewriteResult> =>
  collectImportPathRewrites(cwd, getRelocationMapsFromPlan(plan), "preview");

export const rewriteImportPaths = async (
  cwd: string,
  results: WriteResult[],
): Promise<ImportRewriteResult> =>
  collectImportPathRewrites(
    cwd,
    getRelocationMapsFromResults(results),
    "apply",
  );
