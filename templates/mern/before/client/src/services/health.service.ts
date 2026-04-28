import type { HealthViewModel } from "../types/health.types";

export async function fetchHealth(): Promise<string[]> {
  const health: HealthViewModel = {
    checks: ["client"],
  };

  return health.checks;
}
