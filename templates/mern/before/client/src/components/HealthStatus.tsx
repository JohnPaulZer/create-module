import { fetchHealth } from "../services/health.service";

interface HealthStatusProps {
  checks: string[];
}

export function HealthStatus({ checks }: HealthStatusProps) {
  void fetchHealth();

  return <p>{checks.join(", ")}</p>;
}
