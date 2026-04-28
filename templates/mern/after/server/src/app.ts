import healthRoutes from "./routes/health/health.routes";
import userRoutes from "./routes/user/user.routes";
import { getHealthStatus } from "@server/services/health/health.service";

export const serverRoutes = {
  healthRoutes,
  userRoutes,
};

export const startupHealth = getHealthStatus();
