import { database } from "../config/database";

export function getHealthStatus() {
  return {
    checks: database.health,
  };
}
