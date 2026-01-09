import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as auth from "./schema/auth";

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production",
  },
  schema: {
    ...auth,
  },
});
