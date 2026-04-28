import healthRoutes from "./routes/health.routes";
import userRoutes from "./routes/user.routes";
import { getBillingSummary } from "./services/billing.service";

export const routes = {
  healthRoutes,
  userRoutes,
};

export async function bootstrap() {
  return getBillingSummary();
}
