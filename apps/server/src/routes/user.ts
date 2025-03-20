import { auth } from "../lib/middleware";
import { resetPasswordSchema, suc, userProfileSchema } from "@easy-auth/share";
import { db } from "../db";
import { hash, newHono } from "../lib/utils";
import { eq } from "drizzle-orm";
import { user as userSchema } from "../db/schema";
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
    },
    where: eq(userSchema.id, c.get("payload").sub),
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

user.post("/auth/:provider/link", async (c) => {});
