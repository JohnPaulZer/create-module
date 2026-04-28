import type { Request, Response } from "express";
import { getHealthStatus } from "../services/health.service";
import { ok } from "../utils/http";

export function getHealth(_req: Request, res: Response): void {
  res.json(ok(getHealthStatus()));
}
