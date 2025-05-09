import { z } from "zod";

export const clientIdSchema = z.string().length(32);

export const pageQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(20).default(10),
  offset: z.coerce.number().min(0).default(0),
});
