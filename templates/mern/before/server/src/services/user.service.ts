import { database } from "../config/database";
import type { User } from "../types/user.types";

export function listUsers(): User[] {
  return database.users;
}
