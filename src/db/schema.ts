import { password } from "bun";
import {
  integer,
  pgTable,
  real,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
export const tokensTable = pgTable("tokens", {
  id: integer().generatedAlwaysAsIdentity(),
  contract: varchar().unique(),
  name: varchar({ length: 255 }).notNull().primaryKey(),
});
export const usersTable = pgTable("users", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  password: varchar().notNull(),
  userName: varchar().unique().notNull(),
});
export const snapshotsTable = pgTable("snapshots", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  contract: varchar().references(() => tokensTable.contract),
  currencyName: varchar().references(() => tokensTable.name),
  price: real(),
  volume: real(),
  countOps: integer(),
  created: timestamp({ withTimezone: true }),
});
