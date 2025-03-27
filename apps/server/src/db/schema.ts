import { pgTable, unique, varchar, timestamp, foreignKey, json } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const user = pgTable("user", {
	id: varchar().primaryKey().notNull(),
	email: varchar().notNull(),
	password: varchar(),
	avatar: varchar(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	nickname: varchar().notNull(),
	scope: varchar(),
}, (table) => [
	unique("user_email_key").on(table.email),
]);

export const account = pgTable("account", {
	id: varchar().primaryKey().notNull(),
	uid: varchar().notNull(),
	provider: varchar().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: varchar().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.uid],
			foreignColumns: [user.id],
			name: "account_uid_fkey"
		}),
]);

export const code = pgTable("code", {
	id: varchar().primaryKey().notNull(),
	user: json().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const app = pgTable("app", {
	id: varchar().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: varchar(),
	publicKey: json("public_key").notNull(),
	privateKey: json("private_key").notNull(),
	redirect: varchar().notNull(),
	secret: varchar().notNull(),
});
