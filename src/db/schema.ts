import { integer, pgTable, varchar } from "drizzle-orm/pg-core";
export const tokensTable = pgTable("tokens", {
  contract: integer().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
});
