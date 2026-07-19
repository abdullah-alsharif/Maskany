import { z } from 'zod';

export const backfillQuerySchema = z.object({
  locale: z.enum(['en', 'ar']).optional(),
});

export const refreshPropertySchema = z.object({
  propertyId: z.string().uuid(),
});
