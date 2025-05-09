import { z } from "zod";
import { clientIdSchema } from "./common";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  cft: z.string().min(1, { message: "需要进行人机验证" }),
  client_id: clientIdSchema.optional(),
  state: z.string().optional(),
  redirect_uri: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  client_id: clientIdSchema.optional(),
  state: z.string().optional(),
  redirect_uri: z.string().optional(),
});

export const loginOkSchema = z.object({
  client_id: clientIdSchema,
  state: z.string().optional(),
  redirect_uri: z.string().optional(),
});

export const oauthProviderSchema = z.object({
  provider: z.enum(["github"]),
});

export const oauth2Schema = z.object({
  code: z.string(),
  client_id: clientIdSchema.optional(),
  state: z.string().optional(),
  redirect_uri: z.string().optional(),
});

export const oidcSchema = z.object({
  code: z.string().uuid(),
  client_id: clientIdSchema,
  appSecret: clientIdSchema,
});

export const jwksSchema = z.object({
  client_id: clientIdSchema,
});
