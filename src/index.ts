#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command, Option } from "commander";
import { createModules } from "./commands/createModules.js";
import { logger } from "./utils/logger.js";

const program = new Command();

const getPackageVersion = (): string => {
  try {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: unknown };

    return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
};

program
  .name("moducreate-jpz")
  .description(
    "Add feature folders inside existing Express, MERN, Laravel, and LaraVue layer folders.",
  )
  .version(getPackageVersion())
  .option(
    "-t, --type <type>",
    "project type: express, mern, laravel, or laravue",
  )
  .option(
    "-m, --modules <modules>",
    "comma-separated module names, for example auth,user,booking",
  )
  .option(
    "--auto-structure",
    "scan existing files and move them into matching layer folders (default)",
  )
  .option(
    "--copy-existing",
    "copy matching existing files into layer folders during auto-structure",
  )
  .option(
    "--move-existing",
    "move matching existing files into layer folders during auto-structure (default)",
  )
  .option("--folders-only", "create only folders without starter files")
  .option("--check", "check whether changes are needed without writing files")
  .option("--dry-run", "show the preview without creating files")
  .option("--force", "overwrite existing files without prompting")
  .addOption(
    new Option("-y, --yes", "deprecated; move operations are automatic").hideHelp(),
  )
  .showHelpAfterError();

try {
  await createModules(program.parse().opts());
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
