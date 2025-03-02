import { Elysia, t } from "elysia";
import { ethplorerInstance, instance } from "../http";
import { db } from "./db";
import { snapshotsTable, tokensTable } from "./db/schema";
import { between, desc, eq, sql } from "drizzle-orm";
import Token from "./types";
import cors from "@elysiajs/cors";
import dayjs from "dayjs";

const app = new Elysia()
  .use(cors({ origin: "localhost" }))
  .get("/", () => "Hello Elysia")
  .get("/hi", () => {
    return "hello from backend";
  })
  .get(
    "/TopByVolume",
    async ({ query: { firstDate, secondDate } }) => {
      const from = dayjs(firstDate);
      const to = dayjs(secondDate);
      const query = await db
        .selectDistinctOn([snapshotsTable.currencyName], {
          currencyName: snapshotsTable.currencyName,
          created: snapshotsTable.created,
          contract: snapshotsTable.contract,
          volume: snapshotsTable.volume,
          percentageChange: sql`
          ((volume - LAG(volume) OVER (PARTITION BY ${snapshotsTable.currencyName.name} ORDER BY created)) 
           / NULLIF(LAG(volume) OVER (PARTITION BY ${snapshotsTable.currencyName.name} ORDER BY created), 0)) 
          * 100
        `,
          valueChange: sql<number>`
        CASE
          WHEN LAG(volume) OVER (PARTITION BY ${snapshotsTable.contract} ORDER BY created) IS NULL THEN NULL
          ELSE (volume::NUMERIC - LAG(volume) OVER (PARTITION BY ${snapshotsTable.contract} ORDER BY created))
        END
      `,
        })
        .from(snapshotsTable)
        .where(between(snapshotsTable.created, from.toDate(), to.toDate()));

      //   const snapshots = await db
      //     .select({
      //       percentage: sql`CASE
      //   WHEN ${snapshotsTable.volume_from} = 0 THEN NULL
      //   ELSE ROUND(
      //     ((${tables.your_table.volume_to} - ${tables.your_table.volume_from}) / ${tables.your_table.volume_from}) * 100,
      //     2
      //   )
      // END`,
      //     })
      //     .from(snapshotsTable)
      //     .where(between(snapshotsTable.created, from.toDate(), to.toDate()))
      //     .orderBy(desc(snapshotsTable.volume));

      return query;
    },
    {
      query: t.Object({
        firstDate: t.String(),
        secondDate: t.String(),
      }),
    }
  )
  .get("/Top", async ({ set }) => {
    try {
      console.log("req");
      const response = await ethplorerInstance.get("/getTop", {
        params: { apiKey: "freekey" },
      });
      const tokenList: Token[] = response.data.tokens;
      for (const token of tokenList) {
        await db
          .insert(tokensTable)
          .values({ contract: token.address, name: token.name })
          .onConflictDoNothing();
        await db.insert(snapshotsTable).values({
          currencyName: token.name,
          contract: token.address,
          price: token.price.rate,
          volume: token.volume,
          created: new Date(Date.now()),
        });
      }
      set.status = 200;

      return tokenList.sort((a, b) => b.price.volDiff1 - a.price.volDiff1);
    } catch {
      set.status = 500;
      return "Что-то пошло не так";
    }
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
  .listen(5000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
