"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { oauthApplication } from "@/lib/db/schema/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const checkAdmin = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isAdmin = session?.user.role === "admin";
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
    redirectURLs: string;
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
