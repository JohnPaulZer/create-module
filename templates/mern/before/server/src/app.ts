import healthRoutes from "./routes/health.routes";
import userRoutes from "./routes/user.routes";
import { getHealthStatus } from "@server/services/health.service";

export const serverRoutes = {
  healthRoutes,
  userRoutes,
};

export const startupHealth = getHealthStatus();
