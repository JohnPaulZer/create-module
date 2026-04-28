import type { DashboardViewModel } from "../types/dashboard.types";

export async function fetchDashboardItems(): Promise<string[]> {
  const dashboard: DashboardViewModel = {
    items: ["overview"],
  };

  return dashboard.items;
}
