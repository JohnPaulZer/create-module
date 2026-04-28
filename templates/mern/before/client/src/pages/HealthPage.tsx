import { HealthStatus } from "../components/HealthStatus";
import { useHealth } from "../hooks/useHealth";

export function HealthPage() {
  const health = useHealth();

  return <HealthStatus checks={health.checks} />;
}
