import type { UserViewModel } from "../../types/user/user.types";

export function UserCard(user: UserViewModel) {
  return <article>{user.email}</article>;
}
