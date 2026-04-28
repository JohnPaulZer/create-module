import type { User } from "../types/user/user.types";

export const database: {
  health: string[];
  invoices: string[];
  users: User[];
} = {
  health: ["database", "cache"],
  invoices: ["invoice-1"],
  users: [{ id: "user-1", email: "user@example.com" }],
};
