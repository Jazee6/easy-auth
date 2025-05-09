import { z } from "zod";
import { clientIdSchema } from "./common";

export const newAppSchema = z.object({
  name: z.string().min(1).max(32),
  redirect_uri: z.string().url(),
});

export const deleteAppSchema = z.object({
  client_id: clientIdSchema,
});

export const getAppSchema = z.object({
  client_id: clientIdSchema,
});
