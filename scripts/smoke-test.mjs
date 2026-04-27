import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(rootDir, "dist", "index.js");
const tempDirs = [];

const runCli = (args, cwd = rootDir, options = {}) =>
  new Promise((resolve, reject) => {
    const expectedExitCode = options.expectedExitCode ?? 0;

    execFile(
      process.execPath,
      [cliPath, ...args],
      {
        cwd,
        env: {
          ...process.env,
          FORCE_COLOR: "0",
          NO_COLOR: "1",
        },
      },
      (error, stdout, stderr) => {
        const exitCode = error?.code ?? 0;

        if (exitCode !== expectedExitCode) {
          reject(
            new Error(
              `CLI exited with ${exitCode}, expected ${expectedExitCode}: node ${path.relative(rootDir, cliPath)} ${args.join(" ")}\n${stdout}\n${stderr}`,
            ),
          );
          return;
        }

        resolve({ stdout, stderr });
      },
    );
  });

const makeTempProject = async (name) => {
  const projectDir = await mkdtemp(path.join(tmpdir(), `moducreate-${name}-`));
  tempDirs.push(projectDir);
  return projectDir;
};

const writeJson = (targetPath, value) =>
  writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const assertDirectory = async (targetPath) => {
  const stats = await stat(targetPath);
  assert.equal(stats.isDirectory(), true, `${targetPath} should be a directory`);
};

const assertFile = async (targetPath) => {
  const stats = await stat(targetPath);
  assert.equal(stats.isFile(), true, `${targetPath} should be a file`);
};

const assertMissing = async (targetPath) => {
  try {
    await access(targetPath);
    assert.fail(`${targetPath} should not exist`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
};

try {
  const packageJson = JSON.parse(
    await readFile(path.join(rootDir, "package.json"), "utf8"),
  );
  const versionResult = await runCli(["--version"]);
  assert.equal(versionResult.stdout.trim(), packageJson.version);

  const manualProject = await makeTempProject("manual-");
  await writeJson(path.join(manualProject, "package.json"), {
    dependencies: {
      express: "^4.18.0",
    },
  });
  await mkdir(path.join(manualProject, "src"), { recursive: true });

  await runCli(
    ["--type", "express", "--modules", "auth", "--folders-only"],
    manualProject,
  );
  await assertDirectory(path.join(manualProject, "src", "controllers", "auth"));
  await assertDirectory(path.join(manualProject, "src", "routes", "auth"));
  await assertMissing(path.join(manualProject, "moducreate-jpz-report.md"));

  const commonJsProject = await makeTempProject("commonjs-");
  await writeJson(path.join(commonJsProject, "package.json"), {
    dependencies: {
      express: "^4.18.0",
    },
  });
  await mkdir(path.join(commonJsProject, "src"), { recursive: true });
  await runCli(["--type", "express", "--modules", "auth"], commonJsProject);
  assert.match(
    await readFile(
      path.join(commonJsProject, "src", "routes", "auth", "auth.routes.js"),
      "utf8",
    ),
    /require\("express"\)/,
  );

  const esmProject = await makeTempProject("esm-");
  await writeJson(path.join(esmProject, "package.json"), {
    type: "module",
    dependencies: {
      express: "^4.18.0",
    },
  });
  await mkdir(path.join(esmProject, "src"), { recursive: true });
  await runCli(["--type", "express", "--modules", "billing"], esmProject);
  assert.match(
    await readFile(
      path.join(esmProject, "src", "routes", "billing", "billing.routes.js"),
      "utf8",
    ),
    /\.\.\/\.\.\/controllers\/billing\/billing\.controller\.js/,
  );

  const autoProject = await makeTempProject("auto-");
  await writeJson(path.join(autoProject, "package.json"), {
    dependencies: {
      express: "^4.18.0",
    },
    devDependencies: {
      typescript: "^5.5.3",
    },
  });
  await writeJson(path.join(autoProject, "tsconfig.json"), {
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@/*": ["src/*"],
      },
    },
  });
  await mkdir(path.join(autoProject, "src", "controllers"), { recursive: true });
  await mkdir(path.join(autoProject, "src", "config"), { recursive: true });
  await mkdir(
    path.join(autoProject, "src", "modules", "legacy", "controllers"),
    { recursive: true },
  );
  await mkdir(path.join(autoProject, "src", "routes"), { recursive: true });
  await mkdir(path.join(autoProject, "src", "services"), { recursive: true });
  await mkdir(path.join(autoProject, "src", "utils"), { recursive: true });
  await writeFile(
    path.join(autoProject, "src", "app.ts"),
    'import healthRoutes from "./routes/health.routes";\n\nexport { healthRoutes };\n',
    "utf8",
  );
  await writeFile(
    path.join(autoProject, "src", "alias-entry.ts"),
    'import { list } from "@/services/health.service";\n\nexport { list };\n',
    "utf8",
  );
  await writeFile(
    path.join(autoProject, "src", "routes", "health.routes.ts"),
    'import { index } from "../controllers/health.controller";\n\nexport default index;\n',
    "utf8",
  );
  await writeFile(
    path.join(autoProject, "src", "controllers", "health.controller.ts"),
    'import { list } from "../services/health.service";\nimport { ok } from "../utils/http";\n\nexport const index = () => ok(list());\n',
    "utf8",
  );
  await writeFile(
    path.join(autoProject, "src", "services", "health.service.ts"),
    'import { database } from "../config/database";\n\nexport const list = () => database.health;\n',
    "utf8",
  );
  await writeFile(
    path.join(autoProject, "src", "utils", "http.ts"),
    "export const ok = (value) => value;\n",
    "utf8",
  );
  await writeFile(
    path.join(autoProject, "src", "config", "database.ts"),
    "export const database = { health: [] };\n",
    "utf8",
  );
  await writeFile(
    path.join(
      autoProject,
      "src",
      "modules",
      "legacy",
      "controllers",
      "legacy.controller.ts",
    ),
    "export const legacy = () => [];\n",
    "utf8",
  );

  const checkResult = await runCli(["--check"], autoProject, {
    expectedExitCode: 1,
  });
  assert.match(checkResult.stdout, /Check failed/);

  const dryRunResult = await runCli(["--dry-run"], autoProject);
  assert.match(dryRunResult.stdout, /Import\/namespace preview/);
  await assertFile(path.join(autoProject, "src", "controllers", "health.controller.ts"));

  const confirmationResult = await runCli([], autoProject, {
    expectedExitCode: 1,
  });
  assert.match(confirmationResult.stderr, /requires confirmation/);
  await assertFile(path.join(autoProject, "src", "controllers", "health.controller.ts"));

  await runCli(["--yes"], autoProject);
  await assertFile(
    path.join(autoProject, "src", "controllers", "health", "health.controller.ts"),
  );
  await assertFile(
    path.join(autoProject, "src", "services", "health", "health.service.ts"),
  );
  await assertFile(
    path.join(autoProject, "src", "routes", "health", "health.routes.ts"),
  );
  assert.match(
    await readFile(path.join(autoProject, "src", "app.ts"), "utf8"),
    /"\.\/routes\/health\/health\.routes"/,
  );
  assert.match(
    await readFile(path.join(autoProject, "src", "alias-entry.ts"), "utf8"),
    /"@\/services\/health\/health\.service"/,
  );
  assert.match(
    await readFile(
      path.join(autoProject, "src", "routes", "health", "health.routes.ts"),
      "utf8",
    ),
    /"\.\.\/\.\.\/controllers\/health\/health\.controller"/,
  );
  const rewrittenController = await readFile(
    path.join(autoProject, "src", "controllers", "health", "health.controller.ts"),
    "utf8",
  );
  assert.match(
    rewrittenController,
    /"\.\.\/\.\.\/services\/health\/health\.service"/,
  );
  assert.match(rewrittenController, /"\.\.\/\.\.\/utils\/http"/);
  assert.match(
    await readFile(
      path.join(autoProject, "src", "services", "health", "health.service.ts"),
      "utf8",
    ),
    /"\.\.\/\.\.\/config\/database"/,
  );
  await assertFile(
    path.join(
      autoProject,
      "src",
      "controllers",
      "legacy",
      "legacy.controller.ts",
    ),
  );
  await assertMissing(path.join(autoProject, "src", "modules"));
  await assertMissing(path.join(autoProject, ".moducreate-jpz-backups"));
  await assertMissing(path.join(autoProject, "moducreate-jpz-report.md"));

  const laravelProject = await makeTempProject("laravel-");
  await writeJson(path.join(laravelProject, "composer.json"), {
    require: {
      "laravel/framework": "^11.0",
    },
  });
  await writeFile(path.join(laravelProject, "artisan"), "", "utf8");
  await mkdir(path.join(laravelProject, "app", "Http", "Controllers"), {
    recursive: true,
  });
  await mkdir(path.join(laravelProject, "app", "Services"), {
    recursive: true,
  });
  await writeFile(
    path.join(
      laravelProject,
      "app",
      "Http",
      "Controllers",
      "BookingController.php",
    ),
    "<?php\n\nnamespace App\\Http\\Controllers;\n\nuse App\\Services\\BookingService;\n\nclass BookingController extends Controller\n{\n    public function index(): array\n    {\n        return (new BookingService())->all();\n    }\n}\n",
    "utf8",
  );
  await writeFile(
    path.join(laravelProject, "app", "Services", "BookingService.php"),
    "<?php\n\nnamespace App\\Services;\n\nclass BookingService\n{\n    public function all(): array\n    {\n        return [];\n    }\n}\n",
    "utf8",
  );
  await runCli(["--yes"], laravelProject);
  const rewrittenLaravelController = await readFile(
    path.join(
      laravelProject,
      "app",
      "Http",
      "Controllers",
      "Booking",
      "BookingController.php",
    ),
    "utf8",
  );
  assert.match(
    rewrittenLaravelController,
    /namespace App\\Http\\Controllers\\Booking;/,
  );
  assert.match(
    rewrittenLaravelController,
    /use App\\Http\\Controllers\\Controller;/,
  );
  assert.match(
    rewrittenLaravelController,
    /use App\\Services\\Booking\\BookingService;/,
  );
  assert.match(
    await readFile(
      path.join(
        laravelProject,
        "app",
        "Services",
        "Booking",
        "BookingService.php",
      ),
      "utf8",
    ),
    /namespace App\\Services\\Booking;/,
  );

  console.log("Smoke tests passed.");
} finally {
  await Promise.all(
    tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
}
