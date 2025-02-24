import { Elysia, t } from "elysia";
import { instance } from "../http";
import { db } from "./db";
import { snapshotsTable, tokensTable } from "./db/schema";
import { desc, eq } from "drizzle-orm";

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .get("/hi", () => {
    return "hello from backend";
  })
  .post(
    "/currentRate/:currencyName",
    async ({ params: { currencyName } }) => {
      try {
        const response = await instance.get(
          `exchangerate/${currencyName.toUpperCase()}/USD`
        );
        const date = new Date(response.data.time);
        const currentRate = response.data.rate;

        const previousSnapshot = await db
          .select()
          .from(snapshotsTable)
          .where(eq(snapshotsTable.currencyName, currencyName))
          .orderBy(desc(snapshotsTable.created))
          .limit(1);

        const previousRate = previousSnapshot[0]?.price;

        const isPreviousRateSmaller =
          previousRate !== undefined && previousRate! < currentRate;

        const isExisting = await db
          .select()
          .from(tokensTable)
          .where(eq(tokensTable.name, currencyName));

        let insertId = 0;
        if (isExisting[0]) {
          const res = await db
            .insert(snapshotsTable)
            .values({
              currencyName: currencyName,
              created: date,
              price: currentRate,
            })
            .returning({ insertId: snapshotsTable.id });
          ({ insertId } = res[0]);
        } else {
          await db.insert(tokensTable).values({ name: currencyName });
          const res = await db
            .insert(snapshotsTable)
            .values({
              currencyName: currencyName,
              created: date,
              price: currentRate,
            })
            .returning({ insertId: snapshotsTable.id });
          ({ insertId } = res[0]);
        }

        return { date, currentRate, isPreviousRateSmaller };
      } catch (error) {
        console.error("Error:", error);
        throw error;
      }
    },
    {
      params: t.Object({
        currencyName: t.String(),
      }),
    }
  )
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
