import { zValidator } from "@hono/zod-validator";
import {
  Code,
  err,
  jwksSchema,
  loginSchema,
  oauth2Schema,
  oauthProviderSchema,
  oidcSchema,
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
  signES256JWT,
  signHS256JWT,
  validateTurnstile,
  verifyHS256JWT,
} from "../lib/utils";
import { db } from "../db";
import { and, eq, gt } from "drizzle-orm";
import { user, account as accountSchema, app, code } from "../db/schema";
import { nanoid } from "nanoid";
import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

export const account = newHono();

const setIdTokenCookie = async (
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
    nickname: data.email,
  };
  await db.insert(user).values(newUser);

  await setIdTokenCookie(c, { sub: id, scope: null });
  return c.json(suc());
});

account.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password, appId, state } = c.req.valid("json");

  let a;
  if (appId) {
    a = await db.query.app.findFirst({
      where: eq(app.id, appId),
    });
  }

  const u = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!u || !u.password) {
    return c.json(err(Code.EmailOrPasswordIncorrect));
  }
  if (!compareHash(password, u.password)) {
    return c.json(err(Code.EmailOrPasswordIncorrect));
  }

  const payload = { sub: u.id, scope: u.scope };
  await setIdTokenCookie(c, payload);
  if (a) {
    const nid = nanoid();
    const data: typeof code.$inferInsert = {
      id: nid,
      user: payload,
    };
    await db.insert(code).values(data);

    const url = new URL(a.redirect);
    url.searchParams.set("state", state ?? "");
    url.searchParams.set("code", nid);
    return c.json(
      suc({
        redirect: url.href,
      }),
    );
  }
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
        const newAccount: typeof accountSchema.$inferInsert = {
          id: nanoid(),
          uid: u.id,
          name: data.login,
          provider,
        };
        await db.transaction(async (trx) => {
          await trx.insert(accountSchema).values(newAccount);
          if (!u.avatar) {
            await trx
              .update(user)
              .set({
                avatar: data.avatar_url,
              })
              .where(eq(user.id, u.id));
          }
        });
        return c.json(successRes(Code.AccountLinked));
      }
      return c.json(err(Code.AccountAlreadyLinked));
    }
    return c.json(err(Code.UnKnown));
  },
);

account.post("/oidc/token", zValidator("json", oidcSchema), async (c) => {
  const { appId, appSecret, code: cod } = c.req.valid("json");
  const a = await db.query.app.findFirst({
    where: and(eq(app.id, appId), eq(app.secret, appSecret)),
  });
  if (!a) {
    return c.json(err(Code.ParamsError));
  }
  const cdata = await db.query.code.findFirst({
    where: and(
      eq(code.id, cod),
      gt(code.createdAt, new Date(Date.now() - 60 * 1000 * 2).toISOString()),
    ),
  });
  if (!cdata) {
    return c.json(err(Code.ParamsError));
  }
  return c.json(
    suc({
      id_token: await signES256JWT(
        cdata.user as Record<string, unknown>,
        a.privateKey as Object,
      ),
    }),
  );
});

account.get(
  "/oidc/.well-known/jwks.json",
  zValidator("query", jwksSchema),
  async (c) => {
    const { appId } = c.req.valid("query");
    const a = await db.query.app.findFirst({
      where: eq(app.id, appId),
    });
    if (!a) {
      return c.json(err(Code.ParamsError));
    }
    return c.json({
      keys: [a.publicKey],
    });
  },
);
