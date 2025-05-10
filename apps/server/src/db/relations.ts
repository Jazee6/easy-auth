import { relations } from "drizzle-orm/relations";
import { account, user } from "./schema.js";

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.uid],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
}));
