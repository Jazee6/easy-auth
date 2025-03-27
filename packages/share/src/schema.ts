import { z } from "zod";

const appIdSchema = z.string().length(21);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  appId: appIdSchema.optional(),
  state: z.string().optional(),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  cft: z.string().min(1, { message: "需要进行人机验证" }),
  appId: appIdSchema.optional(),
});

export const userProfileSchema = z.object({
  avatar: z.string().url().or(z.literal("")),
  nickname: z.string().min(1),
});

export const oauth2Schema = z.object({
  code: z.string(),
  appId: appIdSchema,
});

export const oauthProviderSchema = z.object({
  provider: z.enum(["github"]),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export const pageQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(20).default(10),
  offset: z.coerce.number().min(0).default(0),
});

export const newAppSchema = z.object({
  name: z.string().min(1),
  redirect: z.string().url(),
});

export const deleteAppSchema = z.object({
  appId: appIdSchema,
});

export const oidcSchema = z.object({
  code: z.string().length(21),
  appId: appIdSchema,
  appSecret: z.string().length(32),
});

export const jwksSchema = z.object({
  appId: appIdSchema,
});
