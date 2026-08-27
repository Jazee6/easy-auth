import * as v from "valibot";

export const loginSchema = v.object({
  email: v.pipe(
    v.string("Email is required"),
    v.trim(),
    v.nonEmpty("Email is required"),
    v.email("Invalid email address"),
  ),
  password: v.pipe(
    v.string("Password is required"),
    v.nonEmpty("Password is required"),
    v.minLength(8, "Password must be at least 8 characters"),
    v.maxLength(128, "Password must be at most 128 characters"),
  ),
});

export const signupSchema = v.object({
  email: v.pipe(
    v.string("Email is required"),
    v.trim(),
    v.nonEmpty("Email is required"),
    v.email("Invalid email address"),
  ),
  password: v.pipe(
    v.string("Password is required"),
    v.nonEmpty("Password is required"),
    v.minLength(8, "Password must be at least 8 characters"),
    v.maxLength(128, "Password must be at most 128 characters"),
  ),
});

export const profileSchema = v.object({
  name: v.pipe(v.string("Name is required"), v.trim(), v.nonEmpty("Name is required")),
  image: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.check((val) => {
        if (!val) return true;
        try {
          const url = new URL(val);
          return url.protocol === "https:";
        } catch {
          return false;
        }
      }, "Avatar must be a valid HTTPS URL"),
    ),
  ),
});

export type LoginInput = v.InferInput<typeof loginSchema>;
export type SignupInput = v.InferInput<typeof signupSchema>;
export type ProfileInput = v.InferInput<typeof profileSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function deriveInitialName(email: string): string {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.indexOf("@");
  if (atIndex === -1) {
    return normalized;
  }
  return normalized.slice(0, atIndex);
}

export function deriveSignupPayload(input: { email: string; password: string }): {
  email: string;
  password: string;
  name: string;
} {
  const normalizedEmail = normalizeEmail(input.email);
  const name = deriveInitialName(normalizedEmail);
  return {
    email: normalizedEmail,
    password: input.password,
    name,
  };
}

export function getInitials(name?: string | null): string {
  if (!name) return "U";
  const trimmed = name.trim();
  if (!trimmed) return "U";

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

export function translateAuthError(_error: unknown, mode: "login" | "signup"): string {
  if (mode === "login") {
    return "Invalid email or password";
  }
  return "Unable to create user with provided details";
}

export function translateProfileError(_error: unknown): string {
  return "Failed to update profile. Please try again.";
}

export interface RouteRedirectParams {
  pathname: string;
  hasSession: boolean;
}

export function getRouteRedirect({ pathname, hasSession }: RouteRedirectParams): string | null {
  const cleanPath = pathname === "" ? "/" : pathname;

  if (cleanPath === "/") {
    return hasSession ? "/profile" : "/login";
  }

  if (cleanPath === "/login" || cleanPath === "/signup") {
    return hasSession ? "/profile" : null;
  }

  if (cleanPath === "/profile") {
    return hasSession ? null : "/login";
  }

  return null;
}

export function getPostLoginRedirect(): string {
  return "/profile";
}

export function getPostSignupRedirect(): string {
  return "/profile";
}

export function getPostLogoutRedirect(): string {
  return "/login";
}
