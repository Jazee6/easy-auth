import { zValidator } from "@hono/zod-validator";
import {
  Code,
  err,
  loginSchema,
  oauth2Schema,
  oauthProviderSchema,
  signupSchema,
  suc,
  success as successRes,
} from "@easy-auth/share";
import {
  app_secret,
  compareHash,
  hash,
  isProd,
  newHono,
  signHS256JWT,
  validateTurnstile,
  verifyHS256JWT,
} from "../lib/utils";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { user, account as accountSchema } from "../db/schema";
import { nanoid } from "nanoid";
import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { auth } from "../lib/middleware";

export const account = newHono();

const setIdTokenCookie = async (
  c: Context,
  payload: Record<string, unknown>,
) => {
  setCookie(c, "id_token", await signHS256JWT(payload, app_secret), {
    httpOnly: true,
    secure: isProd,
    maxAge: 60 * 60 * 24, // TODO
    prefix: isProd ? "secure" : undefined,
  });
};

account.post("/signup", zValidator("json", signupSchema), async (c) => {
  const data = c.req.valid("json");
  const res = await validateTurnstile(data.cft);
  if (res !== true) {
    return c.json(err(res));
  }

  const u = await db.query.user.findFirst({
    where: eq(user.email, data.email),
  });
  if (u) {
    return c.json(err(Code.UserExists));
  }

  const id = nanoid();
  const newUser: typeof user.$inferInsert = {
    id,
    email: data.email,
    password: hash(data.password),
  };
  await db.insert(user).values(newUser);

  await setIdTokenCookie(c, { sub: id });
  return c.json(suc());
});

account.post("/login", zValidator("json", loginSchema), async (c) => {
  const data = c.req.valid("json");

  const u = await db.query.user.findFirst({
    where: eq(user.email, data.email),
  });
  if (!u || !u.password) {
    return c.json(err(Code.EmailOrPasswordIncorrect));
  }
  if (!compareHash(data.password, u.password)) {
    return c.json(err(Code.EmailOrPasswordIncorrect));
  }

  await setIdTokenCookie(c, { sub: u.id, scope: u.scope });
  return c.json(suc());
});

account.get("/logout", async (c) => {
  setCookie(c, "id_token", "", {
    maxAge: -1,
  });
  return c.json(suc());
});

const handleGithub = async (code: string) => {
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
    return {
      success: false,
      data,
    };
  }
  const profile = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
    },
  });
  return {
    success: true,
    data: await profile.json(),
  };
};

account.post(
  "/auth/:provider",
  zValidator("param", oauthProviderSchema),
  zValidator("json", oauth2Schema),
  async (c) => {
    const { provider } = c.req.valid("param");
    const { code, appId } = c.req.valid("json");
    const { success, data } = await handleGithub(code);
    if (!success) {
      return c.json(err(Code.ParamsError));
    }
    const u = await db.query.user.findFirst({
      where: eq(user.email, data.email),
    });
    if (!u) {
      const id = nanoid();
      const newUser: typeof user.$inferInsert = {
        id,
        email: data.email,
        nickname: data.login,
        avatar: data.avatar_url,
      };
      const newAccount: typeof accountSchema.$inferInsert = {
        id: nanoid(),
        uid: id,
        name: data.login,
        provider,
      };
      await db.transaction(async (trx) => {
        await trx.insert(user).values(newUser);
        await trx.insert(accountSchema).values(newAccount);
      });
      await setIdTokenCookie(c, { sub: id });
      return c.json(suc());
    }

    const a = await db.query.account.findFirst({
      where: and(
        eq(accountSchema.uid, u.id),
        eq(accountSchema.provider, provider),
      ),
    });
    if (a) {
      await setIdTokenCookie(c, { sub: u.id });
      return c.json(suc());
    }

    if (!a) {
      const token = getCookie(c, "id_token");
      if (!token) {
        return c.json(err(Code.AccountAlreadyLinked));
      }
      let res;
      try {
        res = await verifyHS256JWT(token, app_secret);
      } catch (e: any) {
        return c.json(err(Code.AccountAlreadyLinked));
      }
      if (u.id === res.payload.sub) {
        return c.json(successRes(Code.NeedConfirm));
      }
      return c.json(err(Code.AccountAlreadyLinked));
    }
    return c.json(err(Code.UnKnown));
  },
);
