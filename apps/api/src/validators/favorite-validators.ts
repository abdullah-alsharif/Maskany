import { z } from 'zod';

export const propertyIdParamSchema = z.object({
  propertyId: z.string().uuid(),
});

export const mergeBodySchema = z.object({
  propertyIds: z.array(z.string().uuid()).max(100),
});
