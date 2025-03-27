import { genES256JWK, newHono } from "../lib/utils";
import { auth } from "../lib/middleware";
import {
  Code,
  deleteAppSchema,
  newAppSchema,
  pageQuerySchema,
  suc,
} from "@easy-auth/share";
import { db } from "../db";
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { app } from "../db/schema";
import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";

export const apps = newHono();

apps.use(auth);

const validateScope = (c: Context) => {
  const { scope } = c.get("payload");
  return scope === "admin";
};

apps.get("/apps", zValidator("query", pageQuerySchema), async (c) => {
  if (!validateScope(c)) {
    return c.json(Code.PermissionDenied, 403);
  }

  const { limit, offset } = c.req.valid("query");
  const apps = await db.query.app.findMany({
    limit,
    offset,
    columns: {
      id: true,
      name: true,
      redirect: true,
      createdAt: true,
    },
  });

  return c.json(suc(apps));
});

apps.post("/apps", zValidator("json", newAppSchema), async (c) => {
  if (!validateScope(c)) {
    return c.json(Code.PermissionDenied, 403);
  }

  const { name, redirect } = c.req.valid("json");
  const data: typeof app.$inferInsert = {
    name,
    redirect,
    id: nanoid(),
    secret: nanoid(32),
    ...(await genES256JWK()),
  };
  await db.insert(app).values(data);
  return c.json(
    suc({
      id: data.id,
      secret: data.secret,
    }),
  );
});

apps.delete("/apps", zValidator("json", deleteAppSchema), async (c) => {
  if (!validateScope(c)) {
    return c.json(Code.PermissionDenied, 403);
  }

  const { appId } = c.req.valid("json");
  await db.delete(app).where(eq(app.id, appId));
  return c.json(suc());
});
