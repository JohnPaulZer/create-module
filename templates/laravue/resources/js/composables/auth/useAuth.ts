import { ref } from "vue";
import { fetchAuthItems } from "../../services/auth/auth.service";

export function useAuth() {
  const items = ref([]);

  async function loadAuth() {
    items.value = await fetchAuthItems();
  }

  return { items, loadAuth };
}
