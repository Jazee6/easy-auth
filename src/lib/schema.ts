import { z } from "zod";

export const clientIdSchema = z.object({
  client_id: z.string().min(1),
});

export const oauthSearchSchema = z.object({
  ...clientIdSchema.shape,
  scope: z.string().min(1),
});
