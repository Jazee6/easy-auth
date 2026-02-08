import { drizzle } from "drizzle-orm/postgres-js";
import * as auth from "./schema/auth";

export const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production",
  },
  schema: {
    ...auth,
  },
});
