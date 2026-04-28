export interface AuthItem {
  id: string;
  [key: string]: unknown;
}

export async function fetchAuthItems(): Promise<AuthItem[]> {
  return [];
}
