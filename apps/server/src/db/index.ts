import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { isProd } from "../lib/utils";

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    ssl: isProd,
  },
  schema,
});
