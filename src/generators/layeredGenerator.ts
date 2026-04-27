import path from "node:path";
import type {
  GeneratorOptions,
  ModuleFormat,
  ModuleName,
  PlanItem,
  ProjectType,
  ScriptLanguage,
} from "../types.js";

const sourceExt = (language: ScriptLanguage): "ts" | "js" =>
  language === "typescript" ? "ts" : "js";

const componentExt = (language: ScriptLanguage): "tsx" | "jsx" =>
  language === "typescript" ? "tsx" : "jsx";

const importSuffix = (
  language: ScriptLanguage,
  moduleFormat: ModuleFormat,
): string => (language === "javascript" && moduleFormat === "esm" ? ".js" : "");

const addDirectory = (plan: PlanItem[], targetPath: string, description: string): void => {
  plan.push({
    operation: "directory",
    targetPath,
    description,
  });
};

const addFile = (
  plan: PlanItem[],
  targetPath: string,
  content: string,
  description: string,
): void => {
  plan.push({
    operation: "file",
    targetPath,
    content,
    description,
  });
};

const expressTemplates = (
  moduleName: ModuleName,
  language: ScriptLanguage,
  moduleFormat: ModuleFormat,
): Record<string, string> => {
  const title = moduleName.pascal;
  const variable = moduleName.camel;
  const extension = importSuffix(language, moduleFormat);

  if (language === "typescript") {
    return {
      controller: `import type { Request, Response } from "express";

export async function getAll(_req: Request, res: Response): Promise<void> {
  res.json([]);
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json({ id: req.params.id });
}

export async function create(req: Request, res: Response): Promise<void> {
  res.status(201).json(req.body);
}

export async function update(req: Request, res: Response): Promise<void> {
  res.json({ id: req.params.id, ...req.body });
}

export async function remove(_req: Request, res: Response): Promise<void> {
  res.status(204).send();
}
`,
      routes: `import { Router } from "express";
import * as ${variable}Controller from "../../controllers/${moduleName.slug}/${moduleName.slug}.controller";
import { ${variable}Middleware } from "../../middlewares/${moduleName.slug}/${moduleName.slug}.middleware";

const router = Router();

router.get("/", ${variable}Controller.getAll);
router.get("/:id", ${variable}Controller.getById);
router.post("/", ${variable}Middleware, ${variable}Controller.create);
router.put("/:id", ${variable}Middleware, ${variable}Controller.update);
router.delete("/:id", ${variable}Controller.remove);

export default router;
`,
      service: `import type { ${title} } from "../../types/${moduleName.slug}/${moduleName.slug}.types";

export async function getAll(): Promise<${title}[]> {
  return [];
}

export async function getById(id: string): Promise<${title}> {
  return { id };
}
`,
      model: `export const ${variable}Model = {
  name: "${title}",
  collection: "${moduleName.slug}",
};
`,
      middleware: `import type { NextFunction, Request, Response } from "express";

export function ${variable}Middleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
`,
      validation: `export function validate${title}Payload(payload: unknown): unknown {
  return payload;
}
`,
      types: `export interface ${title} {
  id: string;
  [key: string]: unknown;
}
`,
    };
  }

  if (moduleFormat === "esm") {
    return {
      controller: `export async function getAll(_req, res) {
  res.json([]);
}

export async function getById(req, res) {
  res.json({ id: req.params.id });
}

export async function create(req, res) {
  res.status(201).json(req.body);
}

export async function update(req, res) {
  res.json({ id: req.params.id, ...req.body });
}

export async function remove(_req, res) {
  res.status(204).send();
}
`,
      routes: `import { Router } from "express";
import * as ${variable}Controller from "../../controllers/${moduleName.slug}/${moduleName.slug}.controller${extension}";
import { ${variable}Middleware } from "../../middlewares/${moduleName.slug}/${moduleName.slug}.middleware${extension}";

const router = Router();

router.get("/", ${variable}Controller.getAll);
router.get("/:id", ${variable}Controller.getById);
router.post("/", ${variable}Middleware, ${variable}Controller.create);
router.put("/:id", ${variable}Middleware, ${variable}Controller.update);
router.delete("/:id", ${variable}Controller.remove);

export default router;
`,
      service: `export async function getAll() {
  return [];
}

export async function getById(id) {
  return { id };
}
`,
      model: `export const ${variable}Model = {
  name: "${title}",
  collection: "${moduleName.slug}",
};
`,
      middleware: `export function ${variable}Middleware(_req, _res, next) {
  next();
}
`,
      validation: `export function validate${title}Payload(payload) {
  return payload;
}
`,
      types: `/**
 * @typedef {Object} ${title}
 * @property {string} id
 */
`,
    };
  }

  return {
    controller: `async function getAll(_req, res) {
  res.json([]);
}

async function getById(req, res) {
  res.json({ id: req.params.id });
}

async function create(req, res) {
  res.status(201).json(req.body);
}

async function update(req, res) {
  res.json({ id: req.params.id, ...req.body });
}

async function remove(_req, res) {
  res.status(204).send();
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
`,
    routes: `const { Router } = require("express");
const ${variable}Controller = require("../../controllers/${moduleName.slug}/${moduleName.slug}.controller");
const { ${variable}Middleware } = require("../../middlewares/${moduleName.slug}/${moduleName.slug}.middleware");

const router = Router();

router.get("/", ${variable}Controller.getAll);
router.get("/:id", ${variable}Controller.getById);
router.post("/", ${variable}Middleware, ${variable}Controller.create);
router.put("/:id", ${variable}Middleware, ${variable}Controller.update);
router.delete("/:id", ${variable}Controller.remove);

module.exports = router;
`,
    service: `async function getAll() {
  return [];
}

async function getById(id) {
  return { id };
}

module.exports = {
  getAll,
  getById,
};
`,
    model: `const ${variable}Model = {
  name: "${title}",
  collection: "${moduleName.slug}",
};

module.exports = {
  ${variable}Model,
};
`,
    middleware: `function ${variable}Middleware(_req, _res, next) {
  next();
}

module.exports = {
  ${variable}Middleware,
};
`,
    validation: `function validate${title}Payload(payload) {
  return payload;
}

module.exports = {
  validate${title}Payload,
};
`,
    types: `/**
 * @typedef {Object} ${title}
 * @property {string} id
 */
`,
  };
};

const generateExpressLayeredPlan = (
  options: GeneratorOptions,
  root = options.backendRoot ?? ".",
): PlanItem[] => {
  const srcRoot = path.join(options.cwd, root, "src");
  const language = options.backendScriptLanguage ?? options.scriptLanguage;
  const extension = sourceExt(language);
  const folders = [
    ["controllers", "controller"],
    ["routes", "routes"],
    ["services", "service"],
    ["models", "model"],
    ["middlewares", "middleware"],
    ["validations", "validation"],
    ["types", "types"],
  ] as const;

  return options.modules.flatMap((moduleName) => {
    const plan: PlanItem[] = [];

    folders.forEach(([folder, fileType]) => {
      addDirectory(
        plan,
        path.join(srcRoot, folder, moduleName.slug),
        `${moduleName.slug} ${folder} folder`,
      );

      if (!options.includeStarterFiles) {
        return;
      }

      const templates = expressTemplates(moduleName, language, options.moduleFormat);

      addFile(
        plan,
        path.join(
          srcRoot,
          folder,
          moduleName.slug,
          `${moduleName.slug}.${fileType}.${extension}`,
        ),
        templates[fileType],
        `${fileType} starter`,
      );
    });

    return plan;
  });
};

const reactTemplates = (
  moduleName: ModuleName,
  language: ScriptLanguage,
): Record<string, string> => {
  const title = moduleName.pascal;
  const serviceImport =
    language === "javascript"
      ? `../../services/${moduleName.slug}/${moduleName.slug}.service.js`
      : `../../services/${moduleName.slug}/${moduleName.slug}.service`;

  return {
    service:
      language === "typescript"
        ? `export interface ${title}Item {
  id: string;
  [key: string]: unknown;
}

export async function fetch${title}Items(): Promise<${title}Item[]> {
  return [];
}
`
        : `export async function fetch${title}Items() {
  return [];
}
`,
    hook:
      language === "typescript"
        ? `import { useEffect, useState } from "react";
import { fetch${title}Items, type ${title}Item } from "${serviceImport}";

export function use${title}() {
  const [items, setItems] = useState<${title}Item[]>([]);

  useEffect(() => {
    void fetch${title}Items().then(setItems);
  }, []);

  return { items };
}
`
        : `import { useEffect, useState } from "react";
import { fetch${title}Items } from "${serviceImport}";

export function use${title}() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch${title}Items().then(setItems);
  }, []);

  return { items };
}
`,
    component: `export function ${title}() {
  return null;
}
`,
    page: `export function ${title}Page() {
  return null;
}
`,
    type:
      language === "typescript"
        ? `export interface ${title}ViewModel {
  id: string;
}
`
        : `/**
 * @typedef {Object} ${title}ViewModel
 * @property {string} id
 */
`,
  };
};

const generateReactLayeredPlan = (
  options: GeneratorOptions,
  root = options.frontendRoot ?? "client",
): PlanItem[] => {
  const srcRoot = path.join(options.cwd, root, "src");
  const language = options.frontendScriptLanguage ?? options.scriptLanguage;
  const extension = sourceExt(language);
  const uiExtension = componentExt(language);
  const folders = ["components", "pages", "hooks", "services", "types"];

  return options.modules.flatMap((moduleName) => {
    const plan: PlanItem[] = [];
    const templates = reactTemplates(moduleName, language);

    folders.forEach((folder) => {
      addDirectory(
        plan,
        path.join(srcRoot, folder, moduleName.slug),
        `${moduleName.slug} ${folder} folder`,
      );
    });

    if (!options.includeStarterFiles) {
      return plan;
    }

    addFile(
      plan,
      path.join(srcRoot, "services", moduleName.slug, `${moduleName.slug}.service.${extension}`),
      templates.service,
      "React service starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "hooks", moduleName.slug, `use${moduleName.pascal}.${extension}`),
      templates.hook,
      "React hook starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "components", moduleName.slug, `${moduleName.pascal}.${uiExtension}`),
      templates.component,
      "React component starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "pages", moduleName.slug, `${moduleName.pascal}Page.${uiExtension}`),
      templates.page,
      "React page starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "types", moduleName.slug, `${moduleName.slug}.types.${extension}`),
      templates.type,
      "React type starter",
    );

    return plan;
  });
};

const phpTemplates = (moduleName: ModuleName): Record<string, string> => {
  const title = moduleName.pascal;

  return {
    controller: `<?php

namespace App\\Http\\Controllers\\${title};

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\JsonResponse;

class ${title}Controller extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([]);
    }
}
`,
    service: `<?php

namespace App\\Services\\${title};

class ${title}Service
{
    public function getAll(): array
    {
        return [];
    }
}
`,
    repository: `<?php

namespace App\\Repositories\\${title};

class ${title}Repository
{
    public function all(): array
    {
        return [];
    }
}
`,
    request: `<?php

namespace App\\Http\\Requests\\${title};

use Illuminate\\Foundation\\Http\\FormRequest;

class ${title}Request extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [];
    }
}
`,
    resource: `<?php

namespace App\\Http\\Resources\\${title};

use Illuminate\\Http\\Resources\\Json\\JsonResource;

class ${title}Resource extends JsonResource
{
    public function toArray($request): array
    {
        return parent::toArray($request);
    }
}
`,
    model: `<?php

namespace App\\Models\\${title};

use Illuminate\\Database\\Eloquent\\Model;

class ${title} extends Model
{
    protected $guarded = [];
}
`,
    routes: `<?php

use App\\Http\\Controllers\\${title}\\${title}Controller;
use Illuminate\\Support\\Facades\\Route;

Route::prefix('${moduleName.slug}')->name('${moduleName.slug}.')->group(function (): void {
    Route::get('/', [${title}Controller::class, 'index'])->name('index');
});
`,
  };
};

const generateLaravelLayeredPlan = (options: GeneratorOptions): PlanItem[] =>
  options.modules.flatMap((moduleName) => {
    const plan: PlanItem[] = [];
    const folders = [
      "app/Http/Controllers",
      "app/Services",
      "app/Repositories",
      "app/Http/Requests",
      "app/Http/Resources",
      "app/Models",
      "routes",
    ];
    const templates = phpTemplates(moduleName);

    folders.forEach((folder) => {
      addDirectory(
        plan,
        path.join(
          options.cwd,
          folder,
          folder === "routes" ? moduleName.slug : moduleName.pascal,
        ),
        `${moduleName.pascal} ${folder} folder`,
      );
    });

    if (!options.includeStarterFiles) {
      return plan;
    }

    addFile(
      plan,
      path.join(options.cwd, "app/Http/Controllers", moduleName.pascal, `${moduleName.pascal}Controller.php`),
      templates.controller,
      "Laravel controller starter",
    );
    addFile(
      plan,
      path.join(options.cwd, "app/Services", moduleName.pascal, `${moduleName.pascal}Service.php`),
      templates.service,
      "Laravel service starter",
    );
    addFile(
      plan,
      path.join(options.cwd, "app/Repositories", moduleName.pascal, `${moduleName.pascal}Repository.php`),
      templates.repository,
      "Laravel repository starter",
    );
    addFile(
      plan,
      path.join(options.cwd, "app/Http/Requests", moduleName.pascal, `${moduleName.pascal}Request.php`),
      templates.request,
      "Laravel request starter",
    );
    addFile(
      plan,
      path.join(options.cwd, "app/Http/Resources", moduleName.pascal, `${moduleName.pascal}Resource.php`),
      templates.resource,
      "Laravel resource starter",
    );
    addFile(
      plan,
      path.join(options.cwd, "app/Models", moduleName.pascal, `${moduleName.pascal}.php`),
      templates.model,
      "Laravel model starter",
    );
    addFile(
      plan,
      path.join(options.cwd, "routes", moduleName.slug, `${moduleName.slug}.php`),
      templates.routes,
      "Laravel route starter",
    );

    return plan;
  });

const vueTemplates = (
  moduleName: ModuleName,
  language: ScriptLanguage,
): Record<string, string> => {
  const title = moduleName.pascal;
  const serviceImport =
    language === "javascript"
      ? `../../services/${moduleName.slug}/${moduleName.slug}.service.js`
      : `../../services/${moduleName.slug}/${moduleName.slug}.service`;

  return {
    component: `<template>
  <div />
</template>

<script setup${language === "typescript" ? " lang=\"ts\"" : ""}>
</script>
`,
    page: `<template>
  <${title} />
</template>

<script setup${language === "typescript" ? " lang=\"ts\"" : ""}>
import ${title} from "../../components/${moduleName.slug}/${title}.vue";
</script>
`,
    composable: `import { ref } from "vue";
import { fetch${title}Items } from "${serviceImport}";

export function use${title}() {
  const items = ref([]);

  async function load${title}() {
    items.value = await fetch${title}Items();
  }

  return { items, load${title} };
}
`,
    service: `export async function fetch${title}Items() {
  return [];
}
`,
    store: `export const ${moduleName.camel}Store = {};
`,
    type:
      language === "typescript"
        ? `export interface ${title}ViewModel {
  id: string;
}
`
        : `/**
 * @typedef {Object} ${title}ViewModel
 * @property {string} id
 */
`,
  };
};

const generateVueLayeredPlan = (options: GeneratorOptions): PlanItem[] =>
  options.modules.flatMap((moduleName) => {
    const srcRoot = path.join(options.cwd, "resources/js");
    const language = options.frontendScriptLanguage ?? options.scriptLanguage;
    const extension = sourceExt(language);
    const templates = vueTemplates(moduleName, language);
    const folders = ["components", "pages", "composables", "services", "stores", "types"];
    const plan: PlanItem[] = [];

    folders.forEach((folder) => {
      addDirectory(
        plan,
        path.join(srcRoot, folder, moduleName.slug),
        `${moduleName.slug} ${folder} folder`,
      );
    });

    if (!options.includeStarterFiles) {
      return plan;
    }

    addFile(
      plan,
      path.join(srcRoot, "components", moduleName.slug, `${moduleName.pascal}.vue`),
      templates.component,
      "Vue component starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "pages", moduleName.slug, `${moduleName.pascal}Page.vue`),
      templates.page,
      "Vue page starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "composables", moduleName.slug, `use${moduleName.pascal}.${extension}`),
      templates.composable,
      "Vue composable starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "services", moduleName.slug, `${moduleName.slug}.service.${extension}`),
      templates.service,
      "Vue service starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "stores", moduleName.slug, `${moduleName.slug}.store.${extension}`),
      templates.store,
      "Vue store starter",
    );
    addFile(
      plan,
      path.join(srcRoot, "types", moduleName.slug, `${moduleName.slug}.types.${extension}`),
      templates.type,
      "Vue type starter",
    );

    return plan;
  });

export const generateLayeredPlan = (
  projectType: ProjectType,
  options: GeneratorOptions,
): PlanItem[] => {
  if (projectType === "express") {
    return generateExpressLayeredPlan(options, options.backendRoot ?? ".");
  }

  if (projectType === "mern") {
    return [
      ...generateExpressLayeredPlan(
        {
          ...options,
          modules: options.backendModules ?? options.modules,
        },
        options.backendRoot ?? "server",
      ),
      ...generateReactLayeredPlan(
        {
          ...options,
          modules: options.frontendModules ?? options.modules,
        },
        options.frontendRoot ?? "client",
      ),
    ];
  }

  if (projectType === "laravel") {
    return generateLaravelLayeredPlan(options);
  }

  return [
    ...generateLaravelLayeredPlan({
      ...options,
      modules: options.backendModules ?? options.modules,
    }),
    ...generateVueLayeredPlan({
      ...options,
      modules: options.frontendModules ?? options.modules,
    }),
  ];
};
