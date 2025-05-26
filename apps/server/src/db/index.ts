import { drizzle } from "drizzle-orm/node-postgres";
import * as relations from "./relations.js";
import * as schema from "./schema.js";

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    // ssl: isProd,
  },
  schema: {
    ...schema,
    ...relations,
  },
});
