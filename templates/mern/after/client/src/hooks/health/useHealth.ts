import { useEffect, useState } from "react";
import { fetchHealth } from "../../services/health/health.service";

export function useHealth() {
  const [checks, setChecks] = useState<string[]>([]);

  useEffect(() => {
    void fetchHealth().then(setChecks);
  }, []);

  return { checks };
}
