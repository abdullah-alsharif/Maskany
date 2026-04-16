import { Router } from 'express';

/**
 * `GET /api/health` — liveness probe. Returns a stable `{ status, timestamp }`
 * envelope suitable for container orchestrators and uptime monitors.
 */
export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
