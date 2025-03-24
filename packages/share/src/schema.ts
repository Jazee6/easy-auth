import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  cft: z.string().min(1, { message: "需要进行人机验证" }),
  appId: z.string().optional(),
});

export const userProfileSchema = z.object({
  avatar: z.string().url().or(z.literal("")),
  nickname: z.string().min(1),
});

export const oauth2Schema = z.object({
  code: z.string(),
  appId: z.string(),
});

export const oauthProviderSchema = z.object({
  provider: z.enum(["github"]),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});
