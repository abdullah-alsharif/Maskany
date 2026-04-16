import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  res.locals['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}
