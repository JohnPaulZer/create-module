import type { Request, Response } from "express";
import { userModel } from "../../models/user/user.model";
import { listUsers } from "../../services/user/user.service";

export function getUsers(_req: Request, res: Response): void {
  res.json({
    model: userModel.name,
    users: listUsers(),
  });
}
