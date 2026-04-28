import chalk from "chalk";

type LogLevel = "info" | "success" | "warn" | "error" | "muted" | "debug";

const getTimestamp = (): string => {
  const now = new Date();
  return now.toISOString().split("T")[1]?.slice(0, -1) ?? "";
};

const formatMessage = (level: LogLevel, message: string): string => {
  const timestamp = getTimestamp();
  const prefix = chalk.gray(`[${timestamp}]`);

  switch (level) {
    case "info":
      return `${prefix} ${chalk.cyan("ℹ")}  ${message}`;
    case "success":
      return `${prefix} ${chalk.green("✓")}  ${message}`;
    case "warn":
      return `${prefix} ${chalk.yellow("⚠")}  ${message}`;
    case "error":
      return `${prefix} ${chalk.red("✗")}  ${message}`;
    case "debug":
      return `${prefix} ${chalk.magenta("◆")}  ${message}`;
    case "muted":
      return `${prefix} ${chalk.gray("○")}  ${message}`;
  }
};

export const logger = {
  info(message: string): void {
    console.log(formatMessage("info", message));
  },
  success(message: string): void {
    console.log(formatMessage("success", message));
  },
  warn(message: string): void {
    console.log(formatMessage("warn", message));
  },
  error(message: string): void {
    console.error(formatMessage("error", message));
  },
  muted(message: string): void {
    console.log(formatMessage("muted", message));
  },
  debug(message: string): void {
    if (process.env.DEBUG === "true") {
      console.log(formatMessage("debug", message));
    }
  },
};
