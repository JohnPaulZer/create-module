import type { Request, Response } from "express";
import { getHealthStatus } from "../../services/health/health.service";

export function getHealth(_req: Request, res: Response): void {
  res.json(getHealthStatus());
}
