import { Elysia, t } from "elysia";
import { db } from "../../db";

import { and, between, eq, isNotNull, ne, sql } from "drizzle-orm";
import { snapshotsTable, tokensTable } from "../../db/schema";
import dayjs from "dayjs";

const metricsRoutes = new Elysia({ prefix: "/metrics" }).get(
  "/topByOperations",
  async ({ query: { firstDate, secondDate }, set }) => {
    try {
      const from = dayjs(firstDate);
      const to = dayjs(secondDate);
      const query = await db
        .selectDistinctOn([snapshotsTable.currencyName], {
          currencyName: snapshotsTable.currencyName,
          created: snapshotsTable.created,
          contract: snapshotsTable.contract,
          countOps: snapshotsTable.countOps,
          valueChange: sql<number>`
          CASE
            WHEN LAG(${snapshotsTable.countOps}) OVER (PARTITION BY ${snapshotsTable.contract} ORDER BY created) IS NULL THEN NULL
            ELSE (${snapshotsTable.countOps}::NUMERIC - LAG(${snapshotsTable.countOps}) OVER (PARTITION BY ${snapshotsTable.contract} ORDER BY created))
          END
        `,
        })
        .from(snapshotsTable)
        .where(
          and(
            isNotNull(snapshotsTable.countOps),
            between(snapshotsTable.created, from.toDate(), to.toDate())
          )
        );

      if (query) {
        for (let res of query) {
          if (res.countOps) {
            Object.assign(res, {
              percentageChange: (
                (res.valueChange / res.countOps) *
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
    } catch (error) {
      set.status = 500;
      return error;
    }
  },
  {
    query: t.Object({
      firstDate: t.String(),
      secondDate: t.String(),
    }),
  }
);

export default metricsRoutes;
