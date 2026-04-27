import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
import type { ModuleFormat, ProjectType, ScriptLanguage } from "../types.js";

interface DetectionCandidate {
  type: ProjectType;
  confidence: number;
  reasons: string[];
}

export interface DetectionResult {
  detectedType?: ProjectType;
  candidates: DetectionCandidate[];
}

type PackageJson = {
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type ComposerJson = {
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
};

const readJson = async <T>(filePath: string): Promise<T | undefined> => {
  try {
    return (await fs.readJson(filePath)) as T;
  } catch {
    return undefined;
  }
};

const hasDependency = (
  manifest: PackageJson | ComposerJson | undefined,
  dependency: string,
): boolean => {
  if (!manifest) {
    return false;
  }

  const groups = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "require",
    "require-dev",
  ] as const;

  return groups.some((group) => {
    const dependencies = manifest[group as keyof typeof manifest] as
      | Record<string, string>
      | undefined;
    return Boolean(dependencies?.[dependency]);
  });
};

const exists = (cwd: string, targetPath: string): Promise<boolean> =>
  fs.pathExists(path.join(cwd, targetPath));

const hasAny = async (cwd: string, patterns: string[]): Promise<boolean> => {
  const matches = await fg(patterns, {
    cwd,
    onlyFiles: false,
    dot: false,
    deep: 4,
  });

  return matches.length > 0;
};

export const detectProjectType = async (
  cwd: string,
): Promise<DetectionResult> => {
  const rootPackage = await readJson<PackageJson>(path.join(cwd, "package.json"));
  const clientPackage = await readJson<PackageJson>(
    path.join(cwd, "client", "package.json"),
  );
  const serverPackage = await readJson<PackageJson>(
    path.join(cwd, "server", "package.json"),
  );
  const frontendPackage = await readJson<PackageJson>(
    path.join(cwd, "frontend", "package.json"),
  );
  const backendPackage = await readJson<PackageJson>(
    path.join(cwd, "backend", "package.json"),
  );
  const composer = await readJson<ComposerJson>(path.join(cwd, "composer.json"));

  const packages = [
    rootPackage,
    clientPackage,
    serverPackage,
    frontendPackage,
    backendPackage,
  ];
  const packageHas = (dependency: string): boolean =>
    packages.some((manifest) => hasDependency(manifest, dependency));

  const hasExpress = packageHas("express");
  const hasReact = packageHas("react");
  const hasVue = packageHas("vue");
  const hasLaravelFramework = hasDependency(composer, "laravel/framework");
  const hasArtisan = await exists(cwd, "artisan");
  const hasLaravelControllers = await exists(cwd, "app/Http/Controllers");
  const hasResourcesJs = await exists(cwd, "resources/js");
  const hasViteConfig =
    (await exists(cwd, "vite.config.ts")) || (await exists(cwd, "vite.config.js"));
  const hasClientServer =
    ((await exists(cwd, "client")) && (await exists(cwd, "server"))) ||
    ((await exists(cwd, "frontend")) && (await exists(cwd, "backend")));
  const hasSrc = await exists(cwd, "src");
  const hasExpressShape = await hasAny(cwd, [
    "src/routes",
    "src/controllers",
    "src/services",
    "routes",
    "controllers",
    "services",
  ]);
  const hasViteReactFrontend =
    hasReact &&
    (await hasAny(cwd, [
      "vite.config.ts",
      "vite.config.js",
      "client/vite.config.ts",
      "client/vite.config.js",
      "frontend/vite.config.ts",
      "frontend/vite.config.js",
    ]));

  const candidates: DetectionCandidate[] = [];

  if (hasLaravelFramework && hasVue && hasResourcesJs && hasViteConfig) {
    candidates.push({
      type: "laravue",
      confidence: 95,
      reasons: [
        "composer.json contains laravel/framework",
        "package.json contains vue",
        "resources/js and Vite config exist",
      ],
    });
  }

  if (hasLaravelFramework && hasArtisan && hasLaravelControllers) {
    candidates.push({
      type: "laravel",
      confidence: 90,
      reasons: [
        "composer.json contains laravel/framework",
        "artisan file exists",
        "app/Http/Controllers exists",
      ],
    });
  }

  if ((hasExpress && hasReact) || hasClientServer || (hasViteReactFrontend && hasExpress)) {
    candidates.push({
      type: "mern",
      confidence: hasClientServer ? 90 : 82,
      reasons: [
        hasClientServer ? "client and server folders exist" : "React and Express detected",
      ],
    });
  }

  if (hasExpress && (hasSrc || hasExpressShape)) {
    candidates.push({
      type: "express",
      confidence: hasExpressShape ? 85 : 75,
      reasons: [
        "package.json contains express",
        hasExpressShape
          ? "routes/controllers/services style folders exist"
          : "src folder exists",
      ],
    });
  }

  candidates.sort((left, right) => right.confidence - left.confidence);

  return {
    detectedType: candidates[0]?.type,
    candidates,
  };
};

export const detectScriptLanguage = async (
  cwd: string,
  sourceRoot = ".",
): Promise<ScriptLanguage> => {
  const root = path.join(cwd, sourceRoot);

  if (await fs.pathExists(path.join(root, "tsconfig.json"))) {
    return "typescript";
  }

  const manifest = await readJson<PackageJson>(path.join(root, "package.json"));

  if (hasDependency(manifest, "typescript")) {
    return "typescript";
  }

  const tsFiles = await fg(["**/*.ts", "**/*.tsx"], {
    cwd: root,
    ignore: ["node_modules/**", "dist/**", "build/**", "vendor/**"],
    onlyFiles: true,
    deep: 5,
  });

  return tsFiles.length > 0 ? "typescript" : "javascript";
};

export const detectModuleFormat = async (
  cwd: string,
  sourceRoot = ".",
): Promise<ModuleFormat> => {
  const manifest =
    (await readJson<PackageJson>(path.join(cwd, sourceRoot, "package.json"))) ??
    (await readJson<PackageJson>(path.join(cwd, "package.json")));

  return manifest?.type === "module" ? "esm" : "commonjs";
};
