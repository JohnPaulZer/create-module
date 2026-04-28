import fg from "fast-glob";
import fs from "fs-extra";
import path from "node:path";
import type {
  ExistingFileAction,
  GeneratorOptions,
  ModuleName,
  PlanItem,
  ProjectType,
} from "../types.js";
import { formatModuleName } from "../utils/formatModuleName.js";

interface AutoStructureOptions extends GeneratorOptions {
  projectType: ProjectType;
  existingFileAction: ExistingFileAction;
  moduleFilter?: ModuleName[];
}

export interface AutoStructureResult {
  plan: PlanItem[];
  modules: ModuleName[];
  backendModules: ModuleName[];
  frontendModules: ModuleName[];
  matchedFiles: number;
}

const globExtensions = "{ts,tsx,js,jsx,vue,php}";
const skippedModuleNames = new Set([
  "api",
  "app",
  "client",
  "config",
  "configs",
  "database",
  "db",
  "env",
  "error",
  "errors",
  "main",
  "server",
  "vite",
]);

const pathExists = (targetPath: string): Promise<boolean> =>
  fs.pathExists(targetPath);

const toModuleName = (value: string): ModuleName | undefined => {
  const cleaned = value
    .replace(/^use(?=[A-Z])/, "")
    .replace(
      /(?:controller|route|routes|service|model|middleware|validation|types?|request|resource|repository|store)$/i,
      "",
    )
    .replace(/(?:page|component|view|status|check)$/i, "")
    .trim();

  if (!cleaned || /^index$/i.test(cleaned) || /^main$/i.test(cleaned)) {
    return undefined;
  }

  try {
    const moduleName = formatModuleName(cleaned);

    if (skippedModuleNames.has(moduleName.slug)) {
      return undefined;
    }

    return moduleName;
  } catch {
    return undefined;
  }
};

const stripKnownSuffix = (value: string): string =>
  value.replace(
    /\.(controller|controllers|route|routes|service|services|model|models|middleware|middlewares|validation|validations|type|types|request|resource|repository|store)$/i,
    "",
  );

const fileParts = (
  filePath: string,
): { fileName: string; baseName: string; extension: string } | undefined => {
  const fileName = path.basename(filePath);

  if (/\.d\.ts$/i.test(fileName) || /^index\./i.test(fileName)) {
    return undefined;
  }

  const extension = path.extname(fileName);
  const baseName = fileName.slice(0, -extension.length);

  return { fileName, baseName, extension };
};

const moduleFromFileName = (filePath: string): ModuleName | undefined => {
  const parts = fileParts(filePath);

  if (!parts) {
    return undefined;
  }

  return toModuleName(stripKnownSuffix(parts.baseName));
};

const moduleFromPascalFile = (
  filePath: string,
  suffix: string,
): ModuleName | undefined => {
  const fileName = path.basename(filePath, ".php");
  const name =
    suffix && fileName.endsWith(suffix)
      ? fileName.slice(0, -suffix.length)
      : fileName;

  return toModuleName(name);
};

const moduleFromFrontendFile = (filePath: string): ModuleName | undefined => {
  const parts = fileParts(filePath);

  if (!parts) {
    return undefined;
  }

  const withoutSuffix = stripKnownSuffix(parts.baseName);
  const words = withoutSuffix
    .replace(/^use(?=[A-Z])/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  return toModuleName(words[0] ?? withoutSuffix);
};

const relativeSource = (cwd: string, sourcePath: string): string =>
  path.relative(cwd, sourcePath);

const shouldIncludeModule = (
  moduleName: ModuleName,
  moduleFilter: ModuleName[] | undefined,
): boolean => {
  if (!moduleFilter || moduleFilter.length === 0) {
    return true;
  }

  return moduleFilter.some((item) => item.slug === moduleName.slug);
};

const addPlanItem = (
  plan: PlanItem[],
  seenTargets: Set<string>,
  item: PlanItem,
): void => {
  if (
    item.sourcePath &&
    path.normalize(item.sourcePath).toLowerCase() ===
      path.normalize(item.targetPath).toLowerCase()
  ) {
    return;
  }

  const key = path.normalize(item.targetPath).toLowerCase();

  if (seenTargets.has(key)) {
    return;
  }

  seenTargets.add(key);
  plan.push(item);
};

const backendFileKinds = [
  {
    folders: ["controllers"],
    suffix: "controller",
    targetSuffix: "controller",
  },
  {
    folders: ["routes"],
    suffix: "routes",
    targetSuffix: "routes",
  },
  {
    folders: ["services"],
    suffix: "service",
    targetSuffix: "service",
  },
  {
    folders: ["models"],
    suffix: "model",
    targetSuffix: "model",
  },
  {
    folders: ["middlewares", "middleware"],
    suffix: "middleware",
    targetSuffix: "middleware",
  },
  {
    folders: ["validations", "validation"],
    suffix: "validation",
    targetSuffix: "validation",
  },
  {
    folders: ["types"],
    suffix: "types",
    targetSuffix: "types",
  },
];

const scanExpressBackend = async (
  options: AutoStructureOptions,
  sourceRoot: string,
  plan: PlanItem[],
  modules: Map<string, ModuleName>,
  scopedModules: Map<string, ModuleName>,
  seenTargets: Set<string>,
): Promise<number> => {
  const srcRoot = path.join(options.cwd, sourceRoot, "src");

  if (!(await pathExists(srcRoot))) {
    return 0;
  }

  const allFileKinds = backendFileKinds.flatMap((fileKind) =>
    fileKind.folders.map((folder) => ({ folder, suffix: fileKind.suffix })),
  );

  const allFilesResults = await Promise.all(
    allFileKinds.map(async ({ folder, suffix }) => {
      const files = await fg([`${folder}/**/*.${globExtensions}`], {
        cwd: srcRoot,
        onlyFiles: true,
        ignore: ["modules/**"],
      });
      return { folder, suffix, files };
    }),
  );

  let matchedFiles = 0;

  for (const { folder, suffix, files } of allFilesResults) {
    for (const file of files) {
      const sourcePath = path.join(srcRoot, file);
      const moduleName = moduleFromFileName(sourcePath);
      const parts = fileParts(sourcePath);

      if (
        !moduleName ||
        !parts ||
        !shouldIncludeModule(moduleName, options.moduleFilter)
      ) {
        continue;
      }

      modules.set(moduleName.slug, moduleName);
      scopedModules.set(moduleName.slug, moduleName);
      matchedFiles += 1;

      addPlanItem(plan, seenTargets, {
        operation: options.existingFileAction,
        sourcePath,
        targetPath: path.join(
          options.cwd,
          sourceRoot,
          "src",
          folder,
          moduleName.slug,
          path.basename(file),
        ),
        description: `existing ${suffix} from ${relativeSource(options.cwd, sourcePath)}`,
      });
    }
  }

  return matchedFiles;
};

const backendTargetFolderBySuffix = new Map(
  backendFileKinds.map((fileKind) => [
    fileKind.targetSuffix,
    fileKind.folders[0],
  ]),
);

const backendSuffixFromFileName = (filePath: string): string | undefined => {
  const parts = fileParts(filePath);

  if (!parts) {
    return undefined;
  }

  const match = parts.baseName.match(
    /\.(controller|routes|route|service|model|middleware|validation|types?|request|resource|repository|store)$/i,
  );

  if (!match) {
    return undefined;
  }

  const suffix = (match[1] ?? "").toLowerCase();

  if (suffix === "route") {
    return "routes";
  }

  if (suffix === "type") {
    return "types";
  }

  return suffix;
};

const scanLegacyExpressModules = async (
  options: AutoStructureOptions,
  sourceRoot: string,
  plan: PlanItem[],
  modules: Map<string, ModuleName>,
  scopedModules: Map<string, ModuleName>,
  seenTargets: Set<string>,
): Promise<number> => {
  const srcRoot = path.join(options.cwd, sourceRoot, "src");

  if (!(await pathExists(path.join(srcRoot, "modules")))) {
    return 0;
  }

  const files = await fg([`modules/*/**/*.${globExtensions}`], {
    cwd: srcRoot,
    onlyFiles: true,
  });
  let matchedFiles = 0;

  for (const file of files) {
    const sourcePath = path.join(srcRoot, file);
    const segments = file.split(/[\\/]+/);
    const moduleSegment = segments[1];
    const moduleName = moduleSegment ? toModuleName(moduleSegment) : undefined;
    const suffix = backendSuffixFromFileName(sourcePath);
    const targetFolder = suffix
      ? backendTargetFolderBySuffix.get(suffix)
      : undefined;

    if (
      !moduleName ||
      !targetFolder ||
      !shouldIncludeModule(moduleName, options.moduleFilter)
    ) {
      continue;
    }

    modules.set(moduleName.slug, moduleName);
    scopedModules.set(moduleName.slug, moduleName);
    matchedFiles += 1;

    addPlanItem(plan, seenTargets, {
      operation: options.existingFileAction,
      sourcePath,
      targetPath: path.join(
        srcRoot,
        targetFolder,
        moduleName.slug,
        path.basename(file),
      ),
      description: `existing legacy backend module file from ${relativeSource(options.cwd, sourcePath)}`,
    });
  }

  return matchedFiles;
};

const laravelKinds = [
  {
    pattern: "app/Http/Controllers/**/*Controller.php",
    baseFolder: "app/Http/Controllers",
    folder: "Controllers",
    suffix: "Controller",
  },
  {
    pattern: "app/Http/Requests/**/*Request.php",
    baseFolder: "app/Http/Requests",
    folder: "Requests",
    suffix: "Request",
  },
  {
    pattern: "app/Http/Resources/**/*Resource.php",
    baseFolder: "app/Http/Resources",
    folder: "Resources",
    suffix: "Resource",
  },
  {
    pattern: "app/Models/**/*.php",
    baseFolder: "app/Models",
    folder: "Models",
    suffix: "",
  },
  {
    pattern: "app/Services/**/*Service.php",
    baseFolder: "app/Services",
    folder: "Services",
    suffix: "Service",
  },
  {
    pattern: "app/Repositories/**/*Repository.php",
    baseFolder: "app/Repositories",
    folder: "Repositories",
    suffix: "Repository",
  },
];

const scanLaravelBackend = async (
  options: AutoStructureOptions,
  plan: PlanItem[],
  modules: Map<string, ModuleName>,
  scopedModules: Map<string, ModuleName>,
  seenTargets: Set<string>,
): Promise<number> => {
  const allFilesResults = await Promise.all(
    laravelKinds.map(async (fileKind) => {
      const files = await fg([fileKind.pattern], {
        cwd: options.cwd,
        onlyFiles: true,
      });
      return { fileKind, files };
    }),
  );

  let matchedFiles = 0;

  for (const { fileKind, files } of allFilesResults) {
    for (const file of files) {
      const sourcePath = path.join(options.cwd, file);
      const moduleName = moduleFromPascalFile(sourcePath, fileKind.suffix);

      if (
        !moduleName ||
        !shouldIncludeModule(moduleName, options.moduleFilter)
      ) {
        continue;
      }

      modules.set(moduleName.slug, moduleName);
      scopedModules.set(moduleName.slug, moduleName);
      matchedFiles += 1;

      addPlanItem(plan, seenTargets, {
        operation: options.existingFileAction,
        sourcePath,
        targetPath: path.join(
          options.cwd,
          fileKind.baseFolder,
          moduleName.pascal,
          path.basename(file),
        ),
        description: `existing Laravel ${fileKind.folder} file`,
      });
    }
  }

  const routeFiles = await fg(["routes/*.php"], {
    cwd: options.cwd,
    onlyFiles: true,
  });

  for (const file of routeFiles) {
    const sourcePath = path.join(options.cwd, file);
    const routeName = path.basename(file, ".php");

    if (["api", "web", "console", "channels"].includes(routeName)) {
      continue;
    }

    const moduleName = toModuleName(routeName);

    if (!moduleName || !shouldIncludeModule(moduleName, options.moduleFilter)) {
      continue;
    }

    modules.set(moduleName.slug, moduleName);
    scopedModules.set(moduleName.slug, moduleName);
    matchedFiles += 1;

    addPlanItem(plan, seenTargets, {
      operation: options.existingFileAction,
      sourcePath,
      targetPath: path.join(
        options.cwd,
        "routes",
        moduleName.slug,
        path.basename(file),
      ),
      description: "existing Laravel module route file",
    });
  }

  return matchedFiles;
};

const frontendKinds = (projectType: ProjectType) => [
  {
    folders: ["api", "services"],
  },
  {
    folders:
      projectType === "laravue"
        ? ["composables", "hooks"]
        : ["hooks", "loaders"],
  },
  {
    folders: ["components"],
  },
  {
    folders: ["pages", "views"],
  },
  {
    folders: ["stores", "store"],
  },
  {
    folders: ["types"],
  },
];

const scanFrontend = async (
  options: AutoStructureOptions,
  sourceRoot: string,
  plan: PlanItem[],
  modules: Map<string, ModuleName>,
  scopedModules: Map<string, ModuleName>,
  seenTargets: Set<string>,
): Promise<number> => {
  const srcRoot = path.join(options.cwd, sourceRoot);

  if (!(await pathExists(srcRoot))) {
    return 0;
  }

  let matchedFiles = 0;

  for (const fileKind of frontendKinds(options.projectType)) {
    for (const folder of fileKind.folders) {
      const files = await fg([`${folder}/**/*.${globExtensions}`], {
        cwd: srcRoot,
        onlyFiles: true,
        ignore: ["features/**"],
      });

      for (const file of files) {
        const sourcePath = path.join(srcRoot, file);
        const moduleName = moduleFromFrontendFile(sourcePath);

        if (
          !moduleName ||
          !shouldIncludeModule(moduleName, options.moduleFilter)
        ) {
          continue;
        }

        modules.set(moduleName.slug, moduleName);
        scopedModules.set(moduleName.slug, moduleName);
        matchedFiles += 1;

        addPlanItem(plan, seenTargets, {
          operation: options.existingFileAction,
          sourcePath,
          targetPath: path.join(
            options.cwd,
            sourceRoot,
            folder,
            moduleName.slug,
            path.basename(file),
          ),
          description: `existing frontend ${folder} file`,
        });
      }
    }
  }

  return matchedFiles;
};

const legacyFrontendFolders = new Set([
  "api",
  "components",
  "composables",
  "hooks",
  "loaders",
  "pages",
  "services",
  "store",
  "stores",
  "types",
  "views",
]);

const scanLegacyFrontendFeatures = async (
  options: AutoStructureOptions,
  sourceRoot: string,
  plan: PlanItem[],
  modules: Map<string, ModuleName>,
  scopedModules: Map<string, ModuleName>,
  seenTargets: Set<string>,
): Promise<number> => {
  const srcRoot = path.join(options.cwd, sourceRoot);

  if (!(await pathExists(path.join(srcRoot, "features")))) {
    return 0;
  }

  const files = await fg([`features/*/**/*.${globExtensions}`], {
    cwd: srcRoot,
    onlyFiles: true,
  });
  let matchedFiles = 0;

  for (const file of files) {
    const sourcePath = path.join(srcRoot, file);
    const segments = file.split(/[\\/]+/);
    const moduleSegment = segments[1];
    const layerFolder = segments[2];
    const moduleName = moduleSegment ? toModuleName(moduleSegment) : undefined;

    if (
      !moduleName ||
      !layerFolder ||
      !legacyFrontendFolders.has(layerFolder) ||
      !shouldIncludeModule(moduleName, options.moduleFilter)
    ) {
      continue;
    }

    modules.set(moduleName.slug, moduleName);
    scopedModules.set(moduleName.slug, moduleName);
    matchedFiles += 1;

    addPlanItem(plan, seenTargets, {
      operation: options.existingFileAction,
      sourcePath,
      targetPath: path.join(
        srcRoot,
        layerFolder,
        moduleName.slug,
        path.basename(file),
      ),
      description: `existing legacy frontend feature file from ${relativeSource(options.cwd, sourcePath)}`,
    });
  }

  return matchedFiles;
};

export const generateAutoStructurePlan = async (
  options: AutoStructureOptions,
): Promise<AutoStructureResult> => {
  const plan: PlanItem[] = [];
  const modules = new Map<string, ModuleName>();
  const backendModules = new Map<string, ModuleName>();
  const frontendModules = new Map<string, ModuleName>();
  const seenTargets = new Set<string>();
  let matchedFiles = 0;

  if (options.projectType === "express") {
    matchedFiles += await scanExpressBackend(
      options,
      options.backendRoot ?? ".",
      plan,
      modules,
      backendModules,
      seenTargets,
    );
    matchedFiles += await scanLegacyExpressModules(
      options,
      options.backendRoot ?? ".",
      plan,
      modules,
      backendModules,
      seenTargets,
    );
  }

  if (options.projectType === "mern") {
    const backendRoot = options.backendRoot ?? "server";
    const frontendRoot = options.frontendRoot ?? "client";

    matchedFiles += await scanExpressBackend(
      options,
      backendRoot,
      plan,
      modules,
      backendModules,
      seenTargets,
    );
    matchedFiles += await scanLegacyExpressModules(
      options,
      backendRoot,
      plan,
      modules,
      backendModules,
      seenTargets,
    );
    matchedFiles += await scanFrontend(
      options,
      path.join(frontendRoot, "src"),
      plan,
      modules,
      frontendModules,
      seenTargets,
    );
    matchedFiles += await scanLegacyFrontendFeatures(
      options,
      path.join(frontendRoot, "src"),
      plan,
      modules,
      frontendModules,
      seenTargets,
    );
  }

  if (options.projectType === "laravel" || options.projectType === "laravue") {
    matchedFiles += await scanLaravelBackend(
      options,
      plan,
      modules,
      backendModules,
      seenTargets,
    );
  }

  if (options.projectType === "laravue") {
    matchedFiles += await scanFrontend(
      options,
      "resources/js",
      plan,
      modules,
      frontendModules,
      seenTargets,
    );
    matchedFiles += await scanLegacyFrontendFeatures(
      options,
      "resources/js",
      plan,
      modules,
      frontendModules,
      seenTargets,
    );
  }

  return {
    plan,
    modules: [...modules.values()].sort((left, right) =>
      left.slug.localeCompare(right.slug),
    ),
    backendModules: [...backendModules.values()].sort((left, right) =>
      left.slug.localeCompare(right.slug),
    ),
    frontendModules: [...frontendModules.values()].sort((left, right) =>
      left.slug.localeCompare(right.slug),
    ),
    matchedFiles,
  };
};
