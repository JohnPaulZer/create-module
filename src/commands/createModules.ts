import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import ora from "ora";
import {
  detectModuleFormat,
  detectProjectType,
  detectScriptLanguage,
} from "../detectors/detectProjectType.js";
import {
  createBackupPlan,
  generateAutoStructurePlan,
} from "../generators/autoStructureGenerator.js";
import { generateLayeredPlan } from "../generators/layeredGenerator.js";
import type {
  CreateModulesOptions,
  ExistingFileAction,
  GeneratorOptions,
  PlanItem,
  ProjectType,
  ResolvedPlanItem,
  ScriptLanguage,
} from "../types.js";
import { createReport } from "../utils/createReport.js";
import { parseModuleNames } from "../utils/formatModuleName.js";
import { logger } from "../utils/logger.js";
import { resolvePlan, writePlan } from "../utils/safeWriteFile.js";

const projectTypes: ProjectType[] = ["express", "mern", "laravel", "laravue"];

const isProjectType = (value: string | undefined): value is ProjectType =>
  Boolean(value && projectTypes.includes(value as ProjectType));

interface ProjectPaths {
  backendRoot: string;
  frontendRoot: string;
}

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const hasDependency = (manifest: PackageJson | undefined, dependency: string): boolean =>
  Boolean(manifest?.dependencies?.[dependency] ?? manifest?.devDependencies?.[dependency]);

const readPackageJson = async (
  cwd: string,
  candidate: string,
): Promise<PackageJson | undefined> => {
  try {
    return (await fs.readJson(path.join(cwd, candidate, "package.json"))) as PackageJson;
  } catch {
    return undefined;
  }
};

const firstExistingPath = async (
  cwd: string,
  candidates: string[],
  fallback: string,
): Promise<string> => {
  for (const candidate of candidates) {
    if (await fs.pathExists(path.join(cwd, candidate))) {
      return candidate;
    }
  }

  return fallback;
};

const firstProjectPath = async (
  cwd: string,
  candidates: string[],
  dependency: string,
  fallback: string,
): Promise<string> => {
  for (const candidate of candidates) {
    if (hasDependency(await readPackageJson(cwd, candidate), dependency)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (await fs.pathExists(path.join(cwd, candidate, "src"))) {
      return candidate;
    }
  }

  return firstExistingPath(cwd, candidates, fallback);
};

const resolveProjectPaths = async (
  cwd: string,
  projectType: ProjectType,
): Promise<ProjectPaths> => {
  if (projectType === "mern") {
    return {
      backendRoot: await firstProjectPath(
        cwd,
        ["server", "backend"],
        "express",
        "server",
      ),
      frontendRoot: await firstProjectPath(
        cwd,
        ["client", "frontend"],
        "react",
        "client",
      ),
    };
  }

  return {
    backendRoot: ".",
    frontendRoot: ".",
  };
};

const getScriptLanguage = async (
  cwd: string,
  projectType: ProjectType,
  paths: ProjectPaths,
): Promise<ScriptLanguage> => {
  if (projectType === "laravel") {
    return "typescript";
  }

  if (projectType === "mern") {
    return detectScriptLanguage(cwd, paths.frontendRoot);
  }

  return detectScriptLanguage(cwd, ".");
};

const getBackendScriptLanguage = async (
  cwd: string,
  projectType: ProjectType,
  paths: ProjectPaths,
): Promise<ScriptLanguage> => {
  if (projectType === "laravel" || projectType === "laravue") {
    return "typescript";
  }

  return detectScriptLanguage(cwd, projectType === "mern" ? paths.backendRoot : ".");
};

const getFrontendScriptLanguage = async (
  cwd: string,
  projectType: ProjectType,
  paths: ProjectPaths,
): Promise<ScriptLanguage> => {
  if (projectType === "express" || projectType === "laravel") {
    return getScriptLanguage(cwd, projectType, paths);
  }

  return detectScriptLanguage(cwd, projectType === "mern" ? paths.frontendRoot : ".");
};

const buildPlan = (projectType: ProjectType, options: GeneratorOptions): PlanItem[] => {
  return generateLayeredPlan(projectType, options);
};

const previewLimit = 80;

const statusLabel = (item: ResolvedPlanItem): string => {
  switch (item.status) {
    case "create":
      return chalk.green("create");
    case "overwrite":
      return chalk.yellow("overwrite");
    case "exists":
      return chalk.gray("skip");
    case "conflict":
      return chalk.red("conflict");
  }
};

const operationLabel = (item: ResolvedPlanItem): string => {
  if (item.status !== "create") {
    return statusLabel(item);
  }

  switch (item.operation) {
    case "copy":
      return chalk.blue("copy");
    case "move":
      return chalk.magenta("move");
    default:
      return statusLabel(item);
  }
};

const printPreview = (plan: ResolvedPlanItem[]): void => {
  logger.info("\nPreview");

  plan.slice(0, previewLimit).forEach((item) => {
    console.log(`  ${operationLabel(item)} ${item.relativePath}`);
  });

  if (plan.length > previewLimit) {
    logger.muted(`  ...and ${plan.length - previewLimit} more items`);
  }

  const creates = plan.filter(
    (item) =>
      item.status === "create" &&
      (item.operation === "directory" || item.operation === "file"),
  ).length;
  const overwrites = plan.filter((item) => item.status === "overwrite").length;
  const skips = plan.filter((item) => item.status === "exists").length;
  const conflicts = plan.filter((item) => item.status === "conflict").length;
  const copies = plan.filter(
    (item) => item.operation === "copy" && item.status === "create",
  ).length;
  const moves = plan.filter(
    (item) => item.operation === "move" && item.status === "create",
  ).length;

  logger.muted(
    `\nTotals: ${creates} to create, ${copies} to copy, ${moves} to move, ${overwrites} to overwrite, ${skips} to skip, ${conflicts} conflicts`,
  );
};

const getExistingFileAction = async (
  options: CreateModulesOptions,
): Promise<ExistingFileAction> => {
  if (options.copyExisting && options.moveExisting) {
    throw new Error("Use either --copy-existing or --move-existing, not both.");
  }

  if (options.copyExisting) {
    return "copy";
  }

  if (options.moveExisting) {
    return "move";
  }

  return "move";
};

export const createModules = async (
  rawOptions: CreateModulesOptions = {},
): Promise<void> => {
  const cwd = process.cwd();

  if (rawOptions.type && !isProjectType(rawOptions.type)) {
    throw new Error(
      `Unknown project type "${rawOptions.type}". Use express, mern, laravel, or laravue.`,
    );
  }

  if (rawOptions.copyExisting && rawOptions.moveExisting) {
    throw new Error("Use either --copy-existing or --move-existing, not both.");
  }

  const detectionSpinner = ora("Detecting project type").start();
  const detection = await detectProjectType(cwd);
  detectionSpinner.succeed("Project scan complete");

  const projectType =
    (rawOptions.type as ProjectType | undefined) ??
    detection.detectedType;

  if (!projectType) {
    throw new Error(
      "Could not determine a project type automatically. Use --type express, --type mern, --type laravel, or --type laravue.",
    );
  }

  const paths = await resolveProjectPaths(cwd, projectType);
  const shouldAutoStructure = rawOptions.autoStructure ?? !rawOptions.modules;
  const moduleFilter = rawOptions.modules
    ? parseModuleNames(rawOptions.modules)
    : undefined;
  const includeStarterFiles =
    rawOptions.foldersOnly === true ? false : !shouldAutoStructure;

  const scriptLanguage = await getScriptLanguage(cwd, projectType, paths);
  const backendScriptLanguage = await getBackendScriptLanguage(cwd, projectType, paths);
  const frontendScriptLanguage = await getFrontendScriptLanguage(cwd, projectType, paths);
  const moduleFormat = await detectModuleFormat(cwd, paths.backendRoot);
  const planOptions: GeneratorOptions = {
    cwd,
    modules: moduleFilter ?? [],
    includeStarterFiles,
    scriptLanguage,
    backendScriptLanguage,
    frontendScriptLanguage,
    backendRoot: paths.backendRoot,
    frontendRoot: paths.frontendRoot,
    moduleFormat,
  };
  let modules = moduleFilter;
  let plan: PlanItem[];
  let backupDir: string | undefined;

  if (shouldAutoStructure) {
    const existingFileAction = await getExistingFileAction(rawOptions);
    const scanSpinner = ora("Scanning existing files").start();
    const autoStructure = await generateAutoStructurePlan({
      ...planOptions,
      projectType,
      existingFileAction,
      moduleFilter,
    });
    scanSpinner.succeed(`Found ${autoStructure.matchedFiles} matching files`);

    modules = moduleFilter ?? autoStructure.modules;

    if (!modules || modules.length === 0) {
      logger.warn("No module-like files were found.");
      logger.warn("Nothing to auto-structure. Use --modules auth,user to create folders manually.");
      return;
    }

    const needsBackup = autoStructure.plan.length > 0 && rawOptions.backup !== false;
    const backup = needsBackup ? createBackupPlan(cwd, autoStructure.plan) : undefined;
    backupDir = backup?.backupDir;
    plan = [...(backup?.plan ?? []), ...autoStructure.plan];
  } else {
    if (!moduleFilter || moduleFilter.length === 0) {
      throw new Error("Use --modules auth,user to create folders manually.");
    }

    modules = moduleFilter;
    plan = buildPlan(projectType, {
      ...planOptions,
      modules,
    });
  }

  let overwriteFiles = Boolean(rawOptions.force);
  let resolvedPlan = await resolvePlan(cwd, plan, overwriteFiles);

  printPreview(resolvedPlan);

  const existingFiles = resolvedPlan.filter(
    (item) =>
      (item.operation === "file" ||
        item.operation === "copy" ||
        item.operation === "move") &&
      item.status === "exists",
  );

  if (existingFiles.length > 0 && !rawOptions.force) {
    logger.warn("\nExisting target files will be skipped. Use --force to overwrite.");
  }

  const conflicts = resolvedPlan.filter((item) => item.status === "conflict");

  if (conflicts.length > 0) {
    logger.warn("\nConflicts were found. Conflicted paths will be skipped.");
  }

  if (rawOptions.dryRun) {
    logger.success("\nDry run complete. No files were created or changed.");
    return;
  }

  const writeSpinner = ora("Creating folders and files").start();
  const results = await writePlan(resolvedPlan);
  const failed = results.filter((result) => result.action === "failed");

  if (failed.length > 0) {
    writeSpinner.warn("Created folders with some skipped conflicts");
  } else {
    writeSpinner.succeed("Folders created");
  }

  const reportPath = await createReport({
    cwd,
    projectType,
    modules: modules.map((moduleName) => moduleName.slug),
    includeStarterFiles,
    dryRun: Boolean(rawOptions.dryRun),
    overwriteFiles,
    results,
  });

  const created = results.filter((result) => result.action === "created").length;
  const copied = results.filter((result) => result.action === "copied").length;
  const moved = results.filter((result) => result.action === "moved").length;
  const skipped = results.filter((result) => result.action === "skipped").length;
  const overwritten = results.filter(
    (result) => result.action === "overwritten",
  ).length;

  logger.success(
    `\nDone: ${created} created, ${copied} copied, ${moved} moved, ${overwritten} overwritten, ${skipped} skipped.`,
  );

  if (reportPath) {
    logger.muted(`Report: ${path.relative(cwd, reportPath)}`);
  }

  if (backupDir) {
    logger.muted(`Backup: ${path.relative(cwd, backupDir)}`);
  }

  if (failed.length > 0) {
    logger.warn("Review the report for paths that could not be created.");
  }
};
