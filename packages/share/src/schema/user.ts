import { z } from "zod";
import { clientIdSchema } from "./common.js";

export const userProfileSchema = z.object({
  avatar: z.string().url().or(z.literal("")),
  nickname: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export const getUserInfoSchema = z.object({
  client_id: clientIdSchema,
  client_secret: clientIdSchema,
  id_token: z.string(),
});
