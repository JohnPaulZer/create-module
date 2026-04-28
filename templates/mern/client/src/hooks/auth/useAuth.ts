import { useEffect, useState } from "react";
import { fetchAuthItems, type AuthItem } from "../../services/auth/auth.service";

export function useAuth() {
  const [items, setItems] = useState<AuthItem[]>([]);

  useEffect(() => {
    void fetchAuthItems().then(setItems);
  }, []);

  return { items };
}
