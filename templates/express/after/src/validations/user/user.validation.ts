import type { User } from "../../types/user/user.types";

export function validateUserPayload(payload: Partial<User>): Partial<User> {
  return payload;
}
