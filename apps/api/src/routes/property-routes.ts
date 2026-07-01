/**
 * Property routes — mounts the CRUD API under `/api/properties` (PRD §3.2).
 *
 * Endpoints:
 *   - GET    /            — public, cursor-paginated list of ACTIVE properties.
 *   - GET    /my          — authenticated, current user's properties (any status).
 *   - GET    /:id         — public, full detail with images, owner, review summary.
 *   - POST   /            — auth + OWNER user type, creates a property.
 *   - PUT    /:id         — auth + owner match, updates a property.
 *   - DELETE /:id         — auth + owner match, soft-deletes (status=INACTIVE).
 *
 * The business rules live in `property-service.ts`; this module only
 * handles transport concerns: parsing the body/query with zod and
 * forwarding errors to the global error handler.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { parseOrThrow } from '../lib/validation.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireUserId,
} from '../middleware/auth-middleware.js';
import { parseAmenitiesParam, parseTypesParam } from '../services/filter-service.js';
import {
  createProperty,
  deleteProperty,
  getPropertiesByIds,
  getPropertyDetail,
  listActiveProperties,
  listMyProperties,
  updateProperty,
  updatePropertyStatus,
  upsertPropertyTranslation,
} from '../services/property-service.js';
import {
  createPropertySchema,
  listPropertiesQuerySchema,
  propertyIdParamSchema,
  updatePropertySchema,
  updatePropertyStatusSchema,
} from '../validators/property-validators.js';

export function createPropertyRouter(): Router {
  const router = Router();

  // `/my` must be registered before `/:id` so Express routes the literal
  // path to the authenticated handler instead of treating "my" as a UUID.
  router.get(
    '/my',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const properties = await listMyProperties(userId);
      res.status(200).json({ properties });
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = parseOrThrow(listPropertiesQuerySchema, req.query);
      const types = parseTypesParam(query.type);
      const amenities = parseAmenitiesParam(query.amenities);
      const page = await listActiveProperties({
        cursor: query.cursor,
        q: query.q,
        sort: query.sort,
        filters: {
          types,
          city: query.city,
          area: query.area,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          rooms: query.rooms,
          bathrooms: query.bathrooms,
          minRating: query.minRating,
          amenities,
        },
      });
      res.status(200).json(page);
    }),
  );

  router.get(
    '/bulk',
    asyncHandler(async (req, res) => {
      const idsRaw = req.query['ids'] as string | undefined;
      if (!idsRaw) {
        throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Query parameter "ids" is required.');
      }
      const ids = idsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'At least one id is required.');
      }
      if (ids.length > 100) {
        throw new HttpError(
          400,
          ErrorCode.VALIDATION_ERROR,
          'Cannot request more than 100 properties at once.',
        );
      }
      const properties = await getPropertiesByIds(ids);
      res.status(200).json(properties);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const property = await getPropertyDetail(params.id);
      res.status(200).json(property);
    }),
  );

  router.post(
    '/',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const body = parseOrThrow(createPropertySchema, req.body);
      const property = await createProperty(userId, body);
      res.status(201).json(property);
    }),
  );

  router.put(
    '/:id',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const body = parseOrThrow(updatePropertySchema, req.body);
      const property = await updateProperty(userId, params.id, body);
      res.status(200).json(property);
    }),
  );

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      await deleteProperty(userId, params.id);
      res.status(204).send();
    }),
  );

  router.patch(
    '/:id/status',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const body = parseOrThrow(updatePropertyStatusSchema, req.body);
      await updatePropertyStatus(userId, params.id, body.status);
      res.status(200).json({ status: body.status });
    }),
  );

  router.put(
    '/:id/translations/:locale',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const locale = req.params['locale'] as string;
      if (locale !== 'en' && locale !== 'ar') {
        throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Locale must be "en" or "ar".');
      }
      const translationSchema = z.object({
        title: z.string().trim().min(1).max(120),
        summary: z.string().trim().max(300).optional(),
        description: z.string().optional(),
        city: z.string().trim().min(1),
        area: z.string().trim().optional(),
        country: z.string().trim().min(2).optional(),
        amenities: z.array(z.string().trim().min(1)).optional(),
      });
      const body = parseOrThrow(translationSchema, req.body);
      await upsertPropertyTranslation(params.id, userId, locale as 'en' | 'ar', body);
      res.status(200).json({ message: 'Translation saved.' });
    }),
  );

  return router;
}
