import type { NextFunction, Request, Response } from "express";

export function userMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
