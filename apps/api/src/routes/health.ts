import { Router } from 'express';
import { db } from '../lib/db.js';
import { checkDbHealth } from '../services/health-service.js';

/**
 * `GET /api/health` — liveness and readiness probe. Verifies database
 * connectivity and returns a structured status envelope suitable for
 * container orchestrators, load balancers, and uptime monitors.
 *
 * Returns HTTP 200 when healthy (DB connected), or HTTP 503 when
 * degraded (DB unreachable or timeout).
 */
export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const health = await checkDbHealth(db);
    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  return router;
}
