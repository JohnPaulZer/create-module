import path from "node:path";
import fg from "fast-glob";
import fs from "fs-extra";
import type { ResolvedPlanItem, WriteResult } from "../types.js";

export interface PhpRewriteChange {
  filePath: string;
  originalFilePath: string;
  from: string;
  to: string;
  kind: "namespace" | "use" | "import";
}

export interface PhpRewriteResult {
  filesUpdated: number;
  referencesUpdated: number;
  relocatedFiles: number;
  changes: PhpRewriteChange[];
}

interface RelocationMaps {
  originalPathsByCurrent: Map<string, string>;
  relocatedTargetsBySource: Map<string, string>;
}

interface PhpClassRelocation {
  oldFqcn: string;
  newFqcn: string;
}

type RewriteMode = "apply" | "preview";

const phpFilePatterns = ["**/*.php"];
const phpIgnores = ["vendor/**", "node_modules/**", ".git/**", "storage/**"];
const successfulRelocationActions = new Set([
  "copied",
  "moved",
  "overwritten",
]);

const toKey = (targetPath: string): string => path.normalize(path.resolve(targetPath));

const isPhpFile = (targetPath: string): boolean =>
  path.extname(targetPath).toLowerCase() === ".php";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const reservedPhpTypeNames = new Set([
  "array",
  "bool",
  "callable",
  "false",
  "float",
  "int",
  "iterable",
  "mixed",
  "never",
  "null",
  "object",
  "parent",
  "self",
  "static",
  "string",
  "true",
  "void",
]);

const namespaceFromAppPath = (cwd: string, targetPath: string): string | undefined => {
  const relativePath = path.relative(cwd, targetPath);
  const segments = relativePath.split(path.sep);

  if (segments[0] !== "app") {
    return undefined;
  }

  const directorySegments = segments.slice(1, -1);

  return ["App", ...directorySegments].join("\\");
};

const fqcnFromAppPath = (cwd: string, targetPath: string): string | undefined => {
  const namespace = namespaceFromAppPath(cwd, targetPath);

  if (!namespace) {
    return undefined;
  }

  const className = path.basename(targetPath, ".php");

  return `${namespace}\\${className}`;
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
      !result.item.sourcePath ||
      !isPhpFile(result.item.sourcePath)
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
      !isPhpFile(item.sourcePath) ||
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

const getPhpClassRelocations = (
  cwd: string,
  relocatedTargetsBySource: Map<string, string>,
): PhpClassRelocation[] => {
  const relocations: PhpClassRelocation[] = [];

  for (const [sourcePath, targetPath] of relocatedTargetsBySource.entries()) {
    const oldFqcn = fqcnFromAppPath(cwd, sourcePath);
    const newFqcn = fqcnFromAppPath(cwd, targetPath);

    if (!oldFqcn || !newFqcn || oldFqcn === newFqcn) {
      continue;
    }

    relocations.push({
      oldFqcn,
      newFqcn,
    });
  }

  return relocations.sort((left, right) => right.oldFqcn.length - left.oldFqcn.length);
};

const getExistingUseShortNames = (content: string): Set<string> => {
  const names = new Set<string>();
  const useRegex = /^use\s+(?!function\b|const\b)([^;]+);/gm;

  for (const match of content.matchAll(useRegex)) {
    const statement = match[1]?.trim();

    if (!statement) {
      continue;
    }

    const aliasMatch = statement.match(/\bas\s+([A-Za-z_][A-Za-z0-9_]*)$/i);

    if (aliasMatch?.[1]) {
      names.add(aliasMatch[1]);
      continue;
    }

    const className = statement.split("\\").pop()?.trim();

    if (className) {
      names.add(className);
    }
  }

  return names;
};

const getDeclaredClassName = (content: string): string | undefined =>
  content.match(/\b(?:class|interface|trait|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/)?.[1];

const addCandidateClassName = (candidates: Set<string>, value: string): void => {
  const className = value.trim().replace(/^\\/, "");

  if (
    !/^[A-Z][A-Za-z0-9_]*$/.test(className) ||
    reservedPhpTypeNames.has(className.toLowerCase())
  ) {
    return;
  }

  candidates.add(className);
};

const getOldNamespaceImportCandidates = (content: string): Set<string> => {
  const candidates = new Set<string>();

  for (const match of content.matchAll(/\bextends\s+([\\A-Z][A-Za-z0-9_\\]*)/g)) {
    const className = match[1];

    if (className && !className.includes("\\")) {
      addCandidateClassName(candidates, className);
    }
  }

  for (const match of content.matchAll(/\bimplements\s+([^{]+)/g)) {
    const interfaceList = match[1] ?? "";

    interfaceList.split(",").forEach((item) => {
      const className = item.trim();

      if (className && !className.includes("\\")) {
        addCandidateClassName(candidates, className);
      }
    });
  }

  return candidates;
};

const insertUseStatements = (content: string, useStatements: string[]): string => {
  if (useStatements.length === 0) {
    return content;
  }

  const namespaceMatch = content.match(/^namespace\s+[^;]+;/m);

  if (namespaceMatch?.index !== undefined) {
    const insertAt = namespaceMatch.index + namespaceMatch[0].length;
    const afterNamespace = content.slice(insertAt).replace(/^\s*/, "");
    const separator = afterNamespace ? "\n" : "";

    return `${content.slice(0, insertAt)}\n\n${useStatements.join("\n")}${separator}${afterNamespace}`;
  }

  const phpOpenMatch = content.match(/^<\?php/);

  if (phpOpenMatch?.index !== undefined) {
    const insertAt = phpOpenMatch.index + phpOpenMatch[0].length;
    const afterOpen = content.slice(insertAt).replace(/^\s*/, "");
    const separator = afterOpen ? "\n" : "";

    return `${content.slice(0, insertAt)}\n\n${useStatements.join("\n")}${separator}${afterOpen}`;
  }

  return `${useStatements.join("\n")}\n${content}`;
};

const addOldNamespaceImports = (
  content: string,
  oldNamespace: string,
  newNamespace: string,
  currentFilePath: string,
  originalFilePath: string,
  changes: PhpRewriteChange[],
): string => {
  if (oldNamespace === newNamespace) {
    return content;
  }

  const existingUseShortNames = getExistingUseShortNames(content);
  const declaredClassName = getDeclaredClassName(content);
  const candidates = [...getOldNamespaceImportCandidates(content)].filter(
    (className) =>
      className !== declaredClassName && !existingUseShortNames.has(className),
  );
  const useStatements: string[] = [];

  for (const className of candidates) {
    const fqcn = `${oldNamespace}\\${className}`;
    const useRegex = new RegExp(`^use\\s+${escapeRegExp(fqcn)}\\s*;`, "m");

    if (useRegex.test(content)) {
      continue;
    }

    useStatements.push(`use ${fqcn};`);
    changes.push({
      filePath: currentFilePath,
      originalFilePath,
      from: className,
      to: fqcn,
      kind: "import",
    });
  }

  return insertUseStatements(content, useStatements);
};

const rewritePhpContent = (
  cwd: string,
  content: string,
  currentFilePath: string,
  originalFilePath: string,
  classRelocations: PhpClassRelocation[],
  shouldRewriteNamespace: boolean,
): { content: string; changes: PhpRewriteChange[] } => {
  let updatedContent = content;
  const changes: PhpRewriteChange[] = [];

  for (const relocation of classRelocations) {
    const pattern = new RegExp(
      `(^|[^A-Za-z0-9_\\\\])(\\\\?)(${escapeRegExp(relocation.oldFqcn)})(?=[^A-Za-z0-9_\\\\]|$)`,
      "g",
    );

    updatedContent = updatedContent.replace(pattern, (fullMatch, prefix: string, leadingSlash: string) => {
      changes.push({
        filePath: currentFilePath,
        originalFilePath,
        from: relocation.oldFqcn,
        to: relocation.newFqcn,
        kind: "use",
      });

      return `${prefix}${leadingSlash}${relocation.newFqcn}`;
    });
  }

  const newNamespace = shouldRewriteNamespace
    ? namespaceFromAppPath(cwd, currentFilePath)
    : undefined;
  let oldNamespace: string | undefined;

  if (newNamespace) {
    updatedContent = updatedContent.replace(
      /^namespace\s+([^;]+);/m,
      (fullMatch, matchedOldNamespace: string) => {
        const trimmedOldNamespace = matchedOldNamespace.trim();

        if (trimmedOldNamespace === newNamespace) {
          return fullMatch;
        }

        oldNamespace = trimmedOldNamespace;
        changes.push({
          filePath: currentFilePath,
          originalFilePath,
          from: trimmedOldNamespace,
          to: newNamespace,
          kind: "namespace",
        });

        return `namespace ${newNamespace};`;
      },
    );

    if (oldNamespace) {
      updatedContent = addOldNamespaceImports(
        updatedContent,
        oldNamespace,
        newNamespace,
        currentFilePath,
        originalFilePath,
        changes,
      );
    }
  }

  return {
    content: updatedContent,
    changes,
  };
};

const collectPhpNamespaceRewrites = async (
  cwd: string,
  maps: RelocationMaps,
  mode: RewriteMode,
): Promise<PhpRewriteResult> => {
  const { originalPathsByCurrent, relocatedTargetsBySource } = maps;

  if (relocatedTargetsBySource.size === 0) {
    return {
      filesUpdated: 0,
      referencesUpdated: 0,
      relocatedFiles: 0,
      changes: [],
    };
  }

  const files = await fg(phpFilePatterns, {
    cwd,
    ignore: phpIgnores,
    onlyFiles: true,
  });
  const classRelocations = getPhpClassRelocations(cwd, relocatedTargetsBySource);
  const changes: PhpRewriteChange[] = [];
  let filesUpdated = 0;

  for (const file of files) {
    const filePath = toKey(path.join(cwd, file));
    const originalFilePath =
      mode === "apply" ? originalPathsByCurrent.get(filePath) ?? filePath : filePath;
    const currentFilePath =
      mode === "apply" ? filePath : relocatedTargetsBySource.get(filePath) ?? filePath;
    const content = await fs.readFile(filePath, "utf8");
    const rewritten = rewritePhpContent(
      cwd,
      content,
      currentFilePath,
      originalFilePath,
      classRelocations,
      originalFilePath !== currentFilePath,
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
    referencesUpdated: changes.length,
    relocatedFiles: relocatedTargetsBySource.size,
    changes,
  };
};

export const previewPhpNamespaceRewrites = async (
  cwd: string,
  plan: ResolvedPlanItem[],
): Promise<PhpRewriteResult> =>
  collectPhpNamespaceRewrites(cwd, getRelocationMapsFromPlan(plan), "preview");

export const rewritePhpNamespaces = async (
  cwd: string,
  results: WriteResult[],
): Promise<PhpRewriteResult> =>
  collectPhpNamespaceRewrites(cwd, getRelocationMapsFromResults(results), "apply");
