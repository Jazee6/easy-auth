import { auth } from "../lib/middleware";
import {
  Code,
  oauthProviderSchema,
  resetPasswordSchema,
  suc,
  success,
  userProfileSchema,
} from "@easy-auth/share";
import { db } from "../db";
import { hash, newHono } from "../lib/utils";
import { and, eq } from "drizzle-orm";
import { account, user as userSchema } from "../db/schema";
import { zValidator } from "@hono/zod-validator";

export const user = newHono();

user.use(auth);

user.get("/profile", async (c) => {
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
  return c.json(suc(u));
});

user.put("/profile", zValidator("json", userProfileSchema), async (c) => {
  const { nickname, avatar } = c.req.valid("json");
  await db
    .update(userSchema)
    .set({
      nickname,
      avatar,
    })
    .where(eq(userSchema.id, c.get("payload").sub));
  return c.json(suc());
});

user.put("/password", zValidator("json", resetPasswordSchema), async (c) => {
  const { password } = c.req.valid("json");
  await db
    .update(userSchema)
    .set({
      password: hash(password),
    })
    .where(eq(userSchema.id, c.get("payload").sub));
  return c.json(suc());
});

user.get(
  "/auth/:provider/unlink",
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

    return c.json(success(Code.AccountUnlinked));
  },
);
