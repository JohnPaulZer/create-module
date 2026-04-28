import type { UserViewModel } from "../types/user.types";

export function UserCard(user: UserViewModel) {
  return <article>{user.email}</article>;
}
