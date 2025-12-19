"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { oauthApplication } from "@/lib/db/schema/auth";
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
    res: await db.query.oauthApplication.findMany({
      limit: pageSize,
      offset: pageIndex,
      where: (app, { eq }) => eq(app.userId, user.id),
      orderBy: (app, { desc }) => [desc(app.createdAt)],
    }),
    total: await db.$count(oauthApplication),
  };
};

export const updateApp = async (
  id: string,
  params: {
    name: string;
    redirectUrls: string;
  },
) => {
  const { user } = await checkAdmin();

  await db
    .update(oauthApplication)
    .set(params)
    .where(
      and(eq(oauthApplication.id, id), eq(oauthApplication.userId, user.id)),
    );
};

export const addApp = async (params: {
  redirect_uris: string[];
  client_name: string;
}) => {
  await checkAdmin();

  return auth.api.registerOAuthApplication({
    headers: await headers(),
    body: params,
  });
};

export const deleteApp = async (id: string) => {
  const { user } = await checkAdmin();

  await db
    .delete(oauthApplication)
    .where(
      and(eq(oauthApplication.id, id), eq(oauthApplication.userId, user.id)),
    );
};

export const revalidateSession = async () => {
  revalidatePath("/");
};

export const getOAuthApp = async (clientId: string) => {
  return db.query.oauthApplication.findFirst({
    where: eq(oauthApplication.clientId, clientId),
    columns: {
      id: true,
      name: true,
    },
  });
};
