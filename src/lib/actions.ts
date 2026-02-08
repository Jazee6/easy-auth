import { createServerFn } from "@tanstack/react-start";
import { auth } from "@/lib/auth.ts";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db } from "@/db";
import { oauthClient } from "@/db/schema/auth.ts";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { adminMiddleware } from "@/middleware/auth.ts";

const addAppSchema = z.object({
  redirect_uris: z.array(z.url()).min(1),
  client_name: z.string().min(1),
});

export const addApp = createServerFn({ method: "POST" })
  .inputValidator(addAppSchema)
  .handler(async ({ data }) => {
    const { client_id, client_secret } = await auth.api.createOAuthClient({
      headers: getRequestHeaders(),
      body: data,
    });

    return {
      client_id,
      client_secret,
    };
  });

const updateAppSchema = z.object({
  id: z.string().min(1),
  params: z.object({
    name: z.string().min(1),
    redirectUris: z.array(z.url()).min(1),
  }),
});

export const updateApp = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(updateAppSchema)
  .handler(async ({ data, context }) => {
    const { id, params } = data;
    const { user } = context;

    await db
      .update(oauthClient)
      .set(params)
      .where(and(eq(oauthClient.id, id), eq(oauthClient.userId, user.id)));
  });

const basePaginationSchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(10),
});

export const getApps = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(basePaginationSchema)
  .handler(async ({ data, context }) => {
    const { pageSize, pageIndex } = data;
    const { user } = context;

    return {
      res: await db.query.oauthClient.findMany({
        limit: pageSize,
        offset: pageIndex,
        where: (app, { eq }) => eq(app.userId, user.id),
        orderBy: (app, { desc }) => [desc(app.createdAt)],
        columns: {
          id: true,
          name: true,
          clientId: true,
          redirectUris: true,
          createdAt: true,
        },
      }),
      total: await db.$count(oauthClient),
    };
  });

const deleteAppSchema = z.object({
  id: z.string().min(1),
});

export const deleteApp = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(deleteAppSchema)
  .handler(async ({ data, context }) => {
    const { id } = data;
    const { user } = context;

    await db
      .delete(oauthClient)
      .where(and(eq(oauthClient.id, id), eq(oauthClient.userId, user.id)));
  });
