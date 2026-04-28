import type { Request, Response } from "express";

export async function getAll(_req: Request, res: Response): Promise<void> {
  res.json([]);
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json({ id: req.params.id });
}

export async function create(req: Request, res: Response): Promise<void> {
  res.status(201).json(req.body);
}

export async function update(req: Request, res: Response): Promise<void> {
  res.json({ id: req.params.id, ...req.body });
}

export async function remove(_req: Request, res: Response): Promise<void> {
  res.status(204).send();
}
