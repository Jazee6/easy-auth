import { lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { code } from "../db/schema.js";

export const startJobs = () => {
  setInterval(
    async () => {
      await db
        .delete(code)
        .where(
          lt(
            code.createdAt,
            new Date(Date.now() - 1000 * 60 * 2).toISOString(),
          ),
        );
    },
    1000 * 60 * 60 * 8,
  );
};
