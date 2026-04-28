import type { User } from "../types/user/user.types";

export const database: {
  health: string[];
  users: User[];
} = {
  health: ["server"],
  users: [{ id: "user-1", email: "user@example.com" }],
};
