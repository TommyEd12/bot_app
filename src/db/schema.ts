import { integer, pgTable, real, time, timestamp, varchar } from "drizzle-orm/pg-core";
export const tokensTable = pgTable("tokens", {
  id: integer().generatedAlwaysAsIdentity(),
  contract: varchar(),
  name: varchar({ length: 255 }).notNull().primaryKey(),
});
export const snapshotsTable = pgTable("snapshots", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  // contract: varchar().references(() => tokensTable.contract),
  currencyName: varchar().references(() => tokensTable.name),
  price: real(),
  volume: integer(),
  created: timestamp({ withTimezone: true })
});
