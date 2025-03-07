import { Elysia, t } from "elysia";
import { cron } from "@elysiajs/cron";
import { db } from "../../db";

import { between, desc, eq, ne } from "drizzle-orm";
import { snapshotsTable, tokensTable } from "../../db/schema";
import { ethplorerInstance } from "../../../http";
import { schemaToken, TokenInfo } from "../../types";
import dayjs from "dayjs";

const metricsRoutes = new Elysia({ prefix: "/metrics" }).get(
  "/TopByOperations",
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
    return query;
  },
  {
    query: t.Object({
      firstDate: t.String(),
      secondDate: t.String(),
    }),
  }
);

export default metricsRoutes;
