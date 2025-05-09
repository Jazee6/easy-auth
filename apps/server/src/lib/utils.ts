import { Code, err } from "@easy-auth/share";
import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { JSONWebKeySet } from "jose";
import * as jose from "jose";
import { db } from "../db";
import { app, code } from "../db/schema";

const url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const app_secret = process.env.APP_SECRET!;

const node_env = process.env.NODE_ENV || "development";

export const isProd = node_env === "production";

if (!app_secret) {
  throw new Error("APP_SECRET is required");
}

export const validateTurnstile = async (token: string) => {
  const result = await fetch(url, {
    body: JSON.stringify({
      secret: process.env.CFT_SECRET,
      response: token,
    }),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const outcome = (await result.json()) as {
    success: boolean;
  };
  return outcome.success;
};

export const hash = (password: string) => {
  return argon2.hash(password);
};

export const compareHash = (password: string, hash: string) => {
  return argon2.verify(hash, password);
};

export const genES256JWK = async () => {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );
  return {
    publicKey: await crypto.subtle.exportKey("jwk", publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", privateKey),
  };
};

const encoder = new TextEncoder();

export const signHS256JWT = (
  payload: Record<string, unknown>,
  secret: string,
) => {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1d") // TODO
    .sign(encoder.encode(secret));
};

export const verifyHS256JWT = async (jwt: string, secret: string) => {
  try {
    return await jose.jwtVerify(jwt, encoder.encode(secret));
  } catch {
    throw new HTTPException(400);
  }
};

export const verifyES256JWT = async (jwt: string, JWKS: JSONWebKeySet) => {
  try {
    return await jose.jwtVerify(jwt, jose.createLocalJWKSet(JWKS));
  } catch {
    throw new HTTPException(400);
  }
};

export const signES256JWT = async (
  payload: Record<string, unknown>,
  jwk: Object,
) => {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "ES256" })
    .setExpirationTime("1d") // TODO
    .sign(await jose.importJWK(jwk, "ES256"));
};

export type Variables = {
  payload: {
    sub: string;
    scope: string | null;
  };
};

export const newHono = () => {
  return new Hono<{ Variables: Variables }>();
};

export const handleGithub = async (code: string) => {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_ID ?? "",
      client_secret: process.env.GITHUB_SECRET ?? "",
      code,
      redirect_uri: process.env.SITE_URL + "/auth/github",
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new HTTPException(400);
  }
  const profile = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
    },
  });
  return profile.json();
};

export const handleCode = async (
  appId: string,
  payload: Object,
  state?: string,
  redirect_uri?: string,
) => {
  const a = await db.query.app.findFirst({
    where: eq(app.id, appId),
  });
  if (!a) {
    throw new HTTPException(400, { message: err(Code.ParamsWrong) });
  }
  const data: typeof code.$inferInsert = {
    user: payload,
  };
  const i = await db.insert(code).values(data).returning();

  let url = new URL(a.redirectUri);
  console.log(redirect_uri, url);
  if (redirect_uri) {
    const r = new URL(redirect_uri);
    if (r.host === url.host) {
      url = r;
    }
  }
  url.searchParams.set("state", state ?? "");
  url.searchParams.set("code", i[0].id);
  return url.href;
};

export const setIdTokenCookie = async (
  c: Context,
  payload: Record<string, unknown>,
) => {
  setCookie(c, "id_token", await signHS256JWT(payload, app_secret), {
    // TODO sub domain
    httpOnly: true,
    secure: isProd,
    maxAge: 60 * 60 * 24, // TODO
    prefix: isProd ? "secure" : undefined,
  });
};
