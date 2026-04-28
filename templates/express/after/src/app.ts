import healthRoutes from "./routes/health/health.routes";
import userRoutes from "./routes/user/user.routes";
import { getBillingSummary } from "./services/billing/billing.service";

export const routes = {
  healthRoutes,
  userRoutes,
};

export async function bootstrap() {
  return getBillingSummary();
}
