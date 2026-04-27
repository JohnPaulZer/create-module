#!/usr/bin/env node
import { Command } from "commander";
import { createModules } from "./commands/createModules.js";
import { logger } from "./utils/logger.js";

const program = new Command();

program
  .name("moducreate-jpz")
  .description(
    "Add feature folders inside existing Express, MERN, Laravel, and LaraVue layer folders.",
  )
  .version("0.1.0")
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
  .option(
    "--no-backup",
    "skip backup when copying or moving existing files",
  )
  .option("--folders-only", "create only folders without starter files")
  .option("--dry-run", "show the preview without creating files")
  .option("--force", "overwrite existing files without prompting")
  .option("-y, --yes", "kept for script compatibility; the CLI is non-interactive")
  .showHelpAfterError();

try {
  await createModules(program.parse().opts());
} catch (error) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
