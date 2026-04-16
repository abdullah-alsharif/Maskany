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
import { parseOrThrow } from '../lib/validation.js';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireUserId,
} from '../middleware/auth-middleware.js';
import { parseAmenitiesParam, parseTypesParam } from '../services/filter-service.js';
import {
  createProperty,
  getPropertyDetail,
  listActiveProperties,
  listMyProperties,
  softDeleteProperty,
  updateProperty,
} from '../services/property-service.js';
import {
  createPropertySchema,
  listPropertiesQuerySchema,
  propertyIdParamSchema,
  updatePropertySchema,
} from '../validators/property-validators.js';

export function createPropertyRouter(): Router {
  const router = Router();

  // `/my` must be registered before `/:id` so Express routes the literal
  // path to the authenticated handler instead of treating "my" as a UUID.
  router.get('/my', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      const properties = await listMyProperties(userId);
      res.status(200).json({ properties });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
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
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const property = await getPropertyDetail(params.id);
      res.status(200).json(property);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      const body = parseOrThrow(createPropertySchema, req.body);
      const property = await createProperty(userId, body);
      res.status(201).json(property);
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const body = parseOrThrow(updatePropertySchema, req.body);
      const property = await updateProperty(userId, params.id, body);
      res.status(200).json(property);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      await softDeleteProperty(userId, params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
