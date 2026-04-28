import type { Request, Response } from "express";
import { listUsers } from "../services/user.service";

export function getUsers(_req: Request, res: Response): void {
  res.json(listUsers());
}
