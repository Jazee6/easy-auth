import {
  Code,
  err,
  loginOkSchema,
  loginSchema,
  oauth2Schema,
  oauthProviderSchema,
  oidcSchema,
  signupSchema,
} from "@easy_auth/share";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, lt } from "drizzle-orm";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/index.js";
import {
  account as accountSchema,
  app,
  code,
  user,
  user as userSchema,
} from "../db/schema.js";
import { auth, authWithoutErr } from "../lib/middleware.js";
import {
  app_secret,
  compareHash,
  handleCode,
  handleGithub,
  hash,
  newHono,
  setIdTokenCookie,
  signHS256JWT,
  validateTurnstile,
  verifyHS256JWT,
} from "../lib/utils.js";

export const account = newHono();

account.post("/signup", zValidator("json", signupSchema), async (c) => {
  const { email, password, client_id, state, cft, redirect_uri } =
    c.req.valid("json");
  const res = await validateTurnstile(cft);
  if (!res) {
    throw new HTTPException(403, { message: err(Code.TurnstileFailed) });
  }

  const u = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (u) {
    throw new HTTPException(400, { message: err(Code.UserExists) });
  }

  const newUser: typeof user.$inferInsert = {
    email,
    password: await hash(password),
    nickname: email,
  };
  const d = await db.insert(user).values(newUser).returning();

  const payload = { sub: d[0].id, scope: null };
  await setIdTokenCookie(c, payload);

  if (client_id) {
    const redirect = await handleCode(client_id, payload, state, redirect_uri);
    return c.json(
      {
        redirect,
      },
      201,
    );
  }

  return c.body(null, 201);
});

account.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password, client_id, state, redirect_uri } =
    c.req.valid("json");

  const u = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!u || !u.password || !(await compareHash(password, u.password))) {
    return c.json(err(Code.EmailOrPasswordIncorrect));
  }

  const payload = { sub: u.id, scope: u.scope };
  await setIdTokenCookie(c, payload);

  if (client_id) {
    const redirect = await handleCode(client_id, payload, state, redirect_uri);
    return c.json({
      redirect,
    });
  }

  return c.body(null);
});

account.get("/login/check", authWithoutErr, async (c) => {
  const u = await db.query.user.findFirst({
    columns: {
      nickname: true,
      avatar: true,
    },
    where: eq(userSchema.id, c.get("payload").sub),
  });
  return c.json(u);
});

account.post(
  "/login/ok",
  auth,
  zValidator("json", loginOkSchema),
  async (c) => {
    const { client_id, state, redirect_uri } = c.req.valid("json");
    const a = await db.query.app.findFirst({
      where: eq(app.id, client_id),
    });

    if (a) {
      const redirect = await handleCode(
        client_id,
        c.get("payload"),
        state,
        redirect_uri,
      );
      return c.json({
        redirect,
      });
    }
    return c.body(null);
  },
);

account.get("/logout", async (c) => {
  setCookie(c, "id_token", "", {
    maxAge: -1,
  });
  return c.body(null, 200);
});

account.post(
  "/auth/:provider",
  zValidator("param", oauthProviderSchema),
  zValidator("json", oauth2Schema),
  async (c) => {
    const { provider } = c.req.valid("param");
    const { code, client_id, state, redirect_uri } = c.req.valid("json");
    const data = await handleGithub(code);

    const u = await db.query.user.findFirst({
      where: eq(user.email, data.email),
    });
    // Register
    if (!u) {
      const id: string = crypto.randomUUID();
      const newUser: typeof user.$inferInsert = {
        id,
        email: data.email,
        nickname: data.login,
        avatar: data.avatar_url,
      };
      const newAccount: typeof accountSchema.$inferInsert = {
        uid: id,
        name: data.login,
        provider,
        ouid: data.node_id,
      };
      await db.transaction(async (trx) => {
        await trx.insert(user).values(newUser);
        await trx.insert(accountSchema).values(newAccount);
      });
      const payload = { sub: id, scope: null };

      await setIdTokenCookie(c, payload);
      if (client_id) {
        const redirect = await handleCode(
          client_id,
          payload,
          state,
          redirect_uri,
        );
        return c.json({ redirect }, 201);
      }

      return c.body(null, 201);
    }

    // Login
    const a = await db.query.account.findFirst({
      where: and(
        eq(accountSchema.uid, u.id),
        eq(accountSchema.provider, provider),
      ),
    });
    if (a) {
      const payload = { sub: u.id, scope: u.scope };
      await setIdTokenCookie(c, payload);
      if (client_id) {
        const redirect = await handleCode(
          client_id,
          payload,
          state,
          redirect_uri,
        );
        return c.json({ redirect }, 201);
      }

      return c.body(null, 200);
    }

    // link
    if (!a) {
      const token = getCookie(c, "id_token");
      if (!token) {
        throw new HTTPException(403, {
          message: err(Code.AccountAlreadyLinked),
        });
      }
      const { payload } = await verifyHS256JWT(token, app_secret);
      if (u.id === payload.sub) {
        const newAccount: typeof accountSchema.$inferInsert = {
          uid: u.id,
          name: data.login,
          provider,
          ouid: data.node_id,
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

        if (client_id) {
          const redirect = await handleCode(
            client_id,
            payload,
            state,
            redirect_uri,
          );
          return c.json({ redirect }, 201);
        }
        return c.body(null, 200);
      }
      throw new HTTPException(403, {
        message: err(Code.AccountAlreadyLinked),
      });
    }
  },
);

// account.get("/oidc/token", zValidator("query", oidcSchema), async (c) => {
//   const { client_id, appSecret, code: cod } = c.req.valid("query");
//   const a = await db.query.app.findFirst({
//     where: and(eq(app.id, client_id), eq(app.secret, appSecret)),
//   });
//   if (!a) {
//     throw new HTTPException(400);
//   }
//   const cdata = await db
//     .delete(code)
//     .where(
//       and(
//         eq(code.id, cod),
//         gt(code.createdAt, new Date(Date.now() - 60 * 1000 * 2).toISOString()),
//       ),
//     )
//     .returning();
//   if (!cdata.length) {
//     throw new HTTPException(400);
//   }
//   return c.json({
//     id_token: await signES256JWT(
//       cdata[0].user as Record<string, unknown>,
//       a.privateKey as Object,
//     ),
//   });
// });

account.get("/oidc/token", zValidator("query", oidcSchema), async (c) => {
  const { client_id, client_secret, code: cod } = c.req.valid("query");
  const a = await db.query.app.findFirst({
    where: and(eq(app.id, client_id), eq(app.secret, client_secret)),
  });
  if (!a) {
    throw new HTTPException(400);
  }
  const cdata = await db
    .delete(code)
    .where(
      and(
        eq(code.id, cod),
        gt(code.createdAt, new Date(Date.now() - 60 * 1000 * 2).toISOString()),
      ),
    )
    .returning();
  if (!cdata.length) {
    throw new HTTPException(400);
  }
  await db
    .delete(code)
    .where(
      lt(code.createdAt, new Date(Date.now() - 1000 * 60 * 2).toISOString()),
    );
  return c.json({
    id_token: await signHS256JWT(
      cdata[0].user as Record<string, unknown>,
      a.secret,
    ),
  });
});

// account.get(
//   "/oidc/.well-known/jwks.json",
//   zValidator("query", jwksSchema),
//   async (c) => {
//     const { client_id } = c.req.valid("query");
//     const a = await db.query.app.findFirst({
//       where: eq(app.id, client_id),
//     });
//     if (!a) {
//       throw new HTTPException(400);
//     }
//     return c.json({
//       keys: [a.publicKey],
//     });
//   },
// );
