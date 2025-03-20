import { Code } from "@easy-auth/share";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { Hono } from "hono";

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

  const outcome = await result.json();
  if (outcome.success) {
    return true;
  }

  return Code.TurnstileFailed;
};

export const hash = (pw: string) => {
  return bcrypt.hashSync(pw, 10);
};

export const compareHash = (pw: string, hash: string) => {
  return bcrypt.compareSync(pw, hash);
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
  return (
    new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      // .setJti(nanoid())
      .setExpirationTime("1d") // TODO
      // .setIssuer("")
      .sign(encoder.encode(secret))
  );
};

export const verifyHS256JWT = (jwt: string, secret: string) => {
  return jose.jwtVerify(jwt, encoder.encode(secret));
};

type Variables = {
  payload: {
    sub: string;
    scope: string | null;
  };
};

export const newHono = () => {
  return new Hono<{ Variables: Variables }>();
};
