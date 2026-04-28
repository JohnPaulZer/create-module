import { database } from "../config/database";
import { listUsers } from "./user.service";

export function getBillingSummary() {
  return {
    invoices: database.invoices.length,
    users: listUsers().length,
  };
}
