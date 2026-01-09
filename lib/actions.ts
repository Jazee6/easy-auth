"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { oauthClient } from "@/lib/db/schema/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const checkSession = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  return session;
};

export const checkAdmin = async () => {
  const session = await checkSession();
  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    redirect("/");
  }
  return session;
};

export const getApps = async ({
  pageIndex,
  pageSize,
}: {
  pageIndex: number;
  pageSize: number;
}) => {
  const { user } = await checkAdmin();

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
};

export const updateApp = async (
  id: string,
  params: {
    name: string;
    redirectUris: string[];
  },
) => {
  const { user } = await checkAdmin();

  await db
    .update(oauthClient)
    .set(params)
    .where(and(eq(oauthClient.id, id), eq(oauthClient.userId, user.id)));
};

export const addApp = async (params: {
  redirect_uris: string[];
  client_name: string;
}) => {
  await checkAdmin();

  const { client_id, client_secret } = await auth.api.createOAuthClient({
    headers: await headers(),
    body: params,
  });

  return {
    client_id,
    client_secret,
  };
};

export const deleteApp = async (id: string) => {
  const { user } = await checkAdmin();

  await db
    .delete(oauthClient)
    .where(and(eq(oauthClient.id, id), eq(oauthClient.userId, user.id)));
};

export const revalidateSession = async () => {
  revalidatePath("/");
};

export const getOAuthApp = async (clientId: string) => {
  return db.query.oauthClient.findFirst({
    where: eq(oauthClient.clientId, clientId),
    columns: {
      id: true,
      name: true,
    },
  });
};
