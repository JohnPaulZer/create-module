import { database } from "../config/database";

export function getHealthStatus() {
  return {
    healthy: true,
    checks: database.health,
  };
}
