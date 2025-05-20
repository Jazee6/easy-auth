import {
  getUserInfoSchema,
  oauthProviderSchema,
  resetPasswordSchema,
  userProfileSchema,
} from "@easy_auth/share";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db/index.js";
import { account, app, user as userSchema } from "../db/schema.js";
import { auth } from "../lib/middleware.js";
import { hash, newHono, verifyHS256JWT } from "../lib/utils.js";

export const user = newHono();

user.get("/info", zValidator("query", getUserInfoSchema), async (c) => {
  const { client_id, id_token, client_secret } = c.req.valid("query");
  const a = await db.query.app.findFirst({
    where: and(eq(app.id, client_id), eq(app.secret, client_secret)),
  });
  if (!a) {
    throw new HTTPException(403);
  }
  const { payload } = await verifyHS256JWT(id_token, a.secret);
  const u = await db.query.user.findFirst({
    columns: {
      email: true,
      nickname: true,
      avatar: true,
      createdAt: true,
    },
    where: eq(userSchema.id, payload.sub!),
  });
  if (!u) {
    throw new HTTPException(404);
  }
  return c.json(u);
});

user.get("/profile", auth, async (c) => {
  const u = await db.query.user.findFirst({
    columns: {
      email: true,
      nickname: true,
      avatar: true,
      createdAt: true,
      scope: true,
    },
    where: eq(userSchema.id, c.get("payload").sub),
    with: {
      accounts: {
        columns: {
          id: true,
          provider: true,
          name: true,
        },
      },
    },
  });
  return c.json(u);
});

user.patch(
  "/profile",
  auth,
  zValidator("json", userProfileSchema),
  async (c) => {
    const { nickname, avatar } = c.req.valid("json");
    await db
      .update(userSchema)
      .set({
        nickname,
        avatar,
      })
      .where(eq(userSchema.id, c.get("payload").sub));
    return c.body(null, 204);
  },
);

user.put(
  "/password",
  auth,
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const { password } = c.req.valid("json");
    await db
      .update(userSchema)
      .set({
        password: await hash(password),
      })
      .where(eq(userSchema.id, c.get("payload").sub));
    return c.body(null, 204);
  },
);

user.put(
  "/auth/:provider/unlink",
  auth,
  zValidator("param", oauthProviderSchema),
  async (c) => {
    const { provider } = c.req.valid("param");
    await db
      .delete(account)
      .where(
        and(
          eq(account.uid, c.get("payload").sub),
          eq(account.provider, provider),
        ),
      );

    return c.body(null, 204);
  },
);
