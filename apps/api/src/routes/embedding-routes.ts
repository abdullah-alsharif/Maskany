import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { backfillEmbeddings, embedProperty } from '../services/embedding-service.js';

export function createEmbeddingRouter(): Router {
  const router = Router();

  router.post(
    '/embeddings/backfill',
    asyncHandler(async (_req, res) => {
      const result = await backfillEmbeddings();
      res.status(200).json(result);
    }),
  );

  router.post(
    '/embeddings/refresh/:propertyId',
    asyncHandler(async (req, res) => {
      const propertyId = req.params['propertyId'] as string;
      await embedProperty(propertyId);
      res.status(200).json({ propertyId, status: 'refreshed' });
    }),
  );

  return router;
}
