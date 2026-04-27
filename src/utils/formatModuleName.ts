import type { ModuleName } from "../types.js";

const toWords = (value: string): string[] =>
  value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);

const capitalize = (word: string): string =>
  word.length === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

export const formatModuleName = (value: string): ModuleName => {
  const words = toWords(value);

  if (words.length === 0) {
    throw new Error(`Invalid module name: "${value}"`);
  }

  const normalizedWords = words.map((word) => word.toLowerCase());
  const slug = normalizedWords.join("-");
  const safeSlug = /^[a-z]/.test(slug) ? slug : `module-${slug}`;
  const pascal = normalizedWords.map(capitalize).join("");
  const safePascal = /^[A-Za-z]/.test(pascal) ? pascal : `Module${pascal}`;
  const camel = `${safePascal.charAt(0).toLowerCase()}${safePascal.slice(1)}`;

  return {
    raw: value.trim(),
    slug: safeSlug,
    camel,
    pascal: safePascal,
  };
};

export const parseModuleNames = (value: string): ModuleName[] => {
  const seen = new Set<string>();
  const modules = value
    .split(",")
    .map((moduleName) => formatModuleName(moduleName))
    .filter((moduleName) => {
      if (seen.has(moduleName.slug)) {
        return false;
      }

      seen.add(moduleName.slug);
      return true;
    });

  if (modules.length === 0) {
    throw new Error("Add at least one module name, separated by commas.");
  }

  return modules;
};
