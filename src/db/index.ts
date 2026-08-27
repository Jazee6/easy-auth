import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

function getD1Database(): D1Database {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require("cloudflare:workers");
    if (env?.DB) return env.DB;
  } catch {}
  return {} as D1Database;
}

export const db = drizzle(getD1Database(), { schema });
export * from "./schema";
