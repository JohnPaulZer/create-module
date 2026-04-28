import { HealthStatus } from "../../components/health/HealthStatus";
import { useHealth } from "../../hooks/health/useHealth";

export function HealthPage() {
  const health = useHealth();

  return <HealthStatus checks={health.checks} />;
}
