import type { Auth } from "../../types/auth/auth.types";

export async function getAll(): Promise<Auth[]> {
  return [];
}

export async function getById(id: string): Promise<Auth> {
  return { id };
}
