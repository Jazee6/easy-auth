import { db } from "../db";
import { code } from "../db/schema";
import { lt } from "drizzle-orm";

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
    1000 * 60 * 2,
  );
};
