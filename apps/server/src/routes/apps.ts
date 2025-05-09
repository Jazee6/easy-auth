import {
  deleteAppSchema,
  getAppSchema,
  newAppSchema,
  pageQuerySchema,
} from "@easy-auth/share";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "../db";
import { app } from "../db/schema";
import { auth, validateScope } from "../lib/middleware";
import { genES256JWK, newHono } from "../lib/utils";

export const apps = newHono();

apps.get(
  "/app/info/:client_id",
  zValidator("param", getAppSchema),
  async (c) => {
    const { client_id } = c.req.valid("param");
    const a = await db.query.app.findFirst({
      where: eq(app.id, client_id),
      columns: {
        name: true,
        createdAt: true,
      },
    });
    if (!a) {
      throw new HTTPException(400);
    }
    return c.json(a);
  },
);

apps.use(auth);

apps.get(
  "/app",
  validateScope,
  zValidator("query", pageQuerySchema),
  async (c) => {
    const { limit, offset } = c.req.valid("query");
    const apps = await db.query.app.findMany({
      limit,
      offset,
      columns: {
        id: true,
        name: true,
        redirectUri: true,
        createdAt: true,
      },
    });

    return c.json(apps);
  },
);

apps.post(
  "/app",
  validateScope,
  zValidator("json", newAppSchema),
  async (c) => {
    const { name, redirect_uri } = c.req.valid("json");
    const data: typeof app.$inferInsert = {
      id: crypto.randomUUID().replaceAll("-", ""),
      name,
      redirectUri: redirect_uri,
      secret: crypto.randomUUID().replaceAll("-", ""),
      ...(await genES256JWK()),
    };
    await db.insert(app).values(data);
    return c.json(
      {
        id: data.id,
        secret: data.secret,
      },
      201,
    );
  },
);

apps.delete(
  "/app",
  validateScope,
  zValidator("json", deleteAppSchema),
  async (c) => {
    const { client_id } = c.req.valid("json");
    await db.delete(app).where(eq(app.id, client_id));
    return c.body(null, 204);
  },
);
