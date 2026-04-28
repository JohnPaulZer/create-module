import type { ProjectType, CreateModulesOptions } from "../types.js";

const projectTypes: ProjectType[] = ["express", "mern", "laravel", "laravue"];

/**
 * Validates that a string is a valid project type
 */
export function isValidProjectType(value: string | undefined): value is ProjectType {
  return Boolean(value && projectTypes.includes(value as ProjectType));
}

/**
 * Validates module name format
 */
export function isValidModuleName(name: string): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }

  // Check for invalid characters
  if (!/^[a-zA-Z0-9\-_]+$/.test(name.trim())) {
    return false;
  }

  // Check if it starts with a number or special character
  const trimmed = name.trim();
  if (/^[0-9\-_]/.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Validates comma-separated module names
 */
export function validateModuleNames(value: string): string[] {
  if (!value || value.trim().length === 0) {
    throw new Error("Module names cannot be empty");
  }

  const names = value.split(",").map((n) => n.trim()).filter(Boolean);

  if (names.length === 0) {
    throw new Error("At least one module name is required");
  }

  const invalidNames = names.filter((n) => !isValidModuleName(n));

  if (invalidNames.length > 0) {
    throw new Error(
      `Invalid module name(s): ${invalidNames.join(", ")}. Module names must start with a letter and contain only letters, numbers, hyphens, and underscores.`,
    );
  }

  return names;
}

/**
 * Validates CLI options
 */
export function validateOptions(options: CreateModulesOptions): void {
  if (options.type && !isValidProjectType(options.type)) {
    throw new Error(
      `Invalid project type "${options.type}". Must be one of: ${projectTypes.join(", ")}`,
    );
  }

  if (options.copyExisting && options.moveExisting) {
    throw new Error("Cannot use both --copy-existing and --move-existing options together");
  }

  if (options.modules) {
    validateModuleNames(options.modules);
  }

  if (options.check && options.dryRun) {
    throw new Error("Cannot use both --check and --dry-run options together");
  }
}

/**
 * Sanitizes a module name by removing invalid characters and ensuring proper format
 */
export function sanitizeModuleName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .replace(/^[0-9\-_]+/, "");
}
