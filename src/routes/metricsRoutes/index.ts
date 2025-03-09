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
            COALESCE(${snapshotsTable.countOps} - LAG(${snapshotsTable.countOps}, 1, 0) OVER (PARTITION BY ${snapshotsTable.currencyName} ORDER BY created), 0)
          `,
          percentageChange: sql`
              ((${snapshotsTable.countOps} - LAG(${snapshotsTable.countOps}) OVER (PARTITION BY ${snapshotsTable.currencyName.name} ORDER BY created)) 
               / NULLIF(LAG(${snapshotsTable.countOps}) OVER (PARTITION BY ${snapshotsTable.currencyName.name} ORDER BY created), 0)) 
              * 100
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
