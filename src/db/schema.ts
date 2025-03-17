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
  contract: varchar().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
});
export const usersTable = pgTable("users", {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  password: varchar().notNull(),
  userName: varchar().unique().notNull(),
});
export const snapshotsTable = pgTable("snapshots", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tokenContract: varchar().references(() => tokensTable.contract),
  currencyName: varchar(),
  price: real(),
  volume: real(),
  countOps: integer(),
  created: timestamp({ withTimezone: true }),
});
