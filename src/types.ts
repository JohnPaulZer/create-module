export type ProjectType = "express" | "mern" | "laravel" | "laravue";

export type ScriptLanguage = "typescript" | "javascript";

export type ModuleFormat = "esm" | "commonjs";

export type ExistingFileAction = "copy" | "move";

export interface ModuleName {
  raw: string;
  slug: string;
  camel: string;
  pascal: string;
}

export type PlanOperation = "directory" | "file" | "copy" | "move";

export interface PlanItem {
  operation: PlanOperation;
  targetPath: string;
  sourcePath?: string;
  content?: string;
  description?: string;
}

export type PlanStatus = "create" | "exists" | "overwrite" | "conflict";

export interface ResolvedPlanItem extends PlanItem {
  status: PlanStatus;
  relativePath: string;
}

export interface WriteResult {
  item: ResolvedPlanItem;
  action:
    | "created"
    | "copied"
    | "moved"
    | "skipped"
    | "overwritten"
    | "failed";
  error?: string;
}

export interface GeneratorOptions {
  cwd: string;
  modules: ModuleName[];
  backendModules?: ModuleName[];
  frontendModules?: ModuleName[];
  includeStarterFiles: boolean;
  scriptLanguage: ScriptLanguage;
  backendScriptLanguage?: ScriptLanguage;
  frontendScriptLanguage?: ScriptLanguage;
  backendRoot?: string;
  frontendRoot?: string;
  moduleFormat: ModuleFormat;
}

export interface CreateModulesOptions {
  type?: string;
  modules?: string;
  autoStructure?: boolean;
  copyExisting?: boolean;
  moveExisting?: boolean;
  check?: boolean;
  dryRun?: boolean;
  foldersOnly?: boolean;
  force?: boolean;
  yes?: boolean;
}
