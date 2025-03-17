import { Elysia, t } from "elysia";
import { ethplorerInstance, instance } from "../http";
import { db } from "./db";
import { snapshotsTable, tokensTable } from "./db/schema";
import { and, between, desc, eq, max, ne, sql } from "drizzle-orm";
import Token, { TokenInfo } from "./types";
import cors from "@elysiajs/cors";
import dayjs from "dayjs";
import { AxiosPromise, AxiosResponse } from "axios";
import operationsRoutes from "./routes/operationsRoutes";
import metricsRoutes from "./routes/metricsRoutes";
import { userRequest } from "telegraf/typings/button";
import { userRoutes } from "./routes/userRoutes";

const app = new Elysia({ prefix: "/api" })
  .use(cors({ origin: process.env.CORS_ORIGIN }))
  .get("/", () => "Hello Elysia")
  .get("/hi", () => {
    return "hello from backend";
  })
  // .get("/topByOperations", async () => {
  //   const tokens = await db
  //     .select()
  //     .from(tokensTable)
  //     .where(ne(tokensTable.contract, ""));

  //   for (const token of tokens.slice(0, 10)) {
  //     const response: AxiosResponse = await ethplorerInstance.get(
  //       `/getTokenInfo/${token.contract}`,
  //       {
  //         params: { apiKey: "EK-utfXc-Vq1QhUf-j355L" },
  //       }
  //     );
  //     const tokenData: TokenInfo = await response.data;
  //     const latestSnapshot = await db
  //       .select({ id: snapshotsTable.id })
  //       .from(snapshotsTable)
  //       .where(eq(snapshotsTable.contract, tokenData.address))
  //       .orderBy(desc(snapshotsTable.created))
  //       .limit(1)
  //       .then((result) => result[0]?.id);

  //     if (latestSnapshot) {
  //       await db
  //         .update(snapshotsTable)
  //         .set({ countOps: tokenData.countOps })
  //         .where(eq(snapshotsTable.id, latestSnapshot));
  //     } else {
  //       console.warn(
  //         `No snapshots found for token contract: ${tokenData.address}`
  //       );
  //     }
  //   }
  // })
  .get(
    "/TopByVolume",
    async ({ query: { firstDate, secondDate }, set }) => {
      const from = dayjs(firstDate);
      const to = dayjs(secondDate);
      const query = await db
        .selectDistinctOn([snapshotsTable.currencyName], {
          currencyName: snapshotsTable.currencyName,
          created: snapshotsTable.created,
          contract: snapshotsTable.tokenContract,
          volume: snapshotsTable.volume,
          valueChange: sql<number>`
          CASE
            WHEN LAG(${snapshotsTable.volume}) OVER (PARTITION BY ${snapshotsTable.tokenContract} ORDER BY created) IS NULL THEN NULL
            ELSE (${snapshotsTable.volume}::NUMERIC - LAG(${snapshotsTable.volume}) OVER (PARTITION BY ${snapshotsTable.tokenContract} ORDER BY created))
          END
      `,
        })
        .from(snapshotsTable)
        .where(between(snapshotsTable.created, from.toDate(), to.toDate()));

      if (query) {
        for (let res of query) {
          if (res.volume) {
            Object.assign(res, {
              percentageChange: (
                (res.valueChange / res.volume) *
                100
              ).toPrecision(6),
            });
          } else {
            Object.assign(res, {
              percentageChange: null,
            });
          }
        }
        set.status = 200;
        return query;
      }
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
        params: { apiKey: process.env.API_KEY },
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
          volume: token.price.marketCapUsd,
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
  .group("", (app) => app.use(operationsRoutes))
  .group("", (app) => app.use(metricsRoutes))
  .group("", (app)=> app.use(userRoutes))
  .listen(5000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
