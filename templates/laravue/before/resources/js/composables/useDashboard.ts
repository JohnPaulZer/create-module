import { ref } from "vue";
import { fetchDashboardItems } from "../services/dashboard.service";

export function useDashboard() {
  const items = ref<string[]>([]);

  async function loadDashboard() {
    items.value = await fetchDashboardItems();
  }

  return { items, loadDashboard };
}
