import { Elysia, t } from "elysia";
import { cron } from "@elysiajs/cron";
import { db } from "../../db";

import { desc, eq, ne } from "drizzle-orm";
import { snapshotsTable, tokensTable } from "../../db/schema";
import { ethplorerInstance } from "../../../http";
import { schemaToken, TokenInfo } from "../../types";

async function updateCountOpsBatch(tokens: schemaToken[]): Promise<void> {
  for (const token of tokens) {
    try {
      const response = await ethplorerInstance.get(
        `/getTokenInfo/${token.contract}`,
        {
          params: { apiKey: process.env.API_KEY },
        }
      );

      const tokenData: TokenInfo = response.data;
      const latestSnapshot = await db
        .select({ id: snapshotsTable.id })
        .from(snapshotsTable)
        .where(eq(snapshotsTable.contract, tokenData.address))
        .orderBy(desc(snapshotsTable.created))
        .limit(1)
        .then((result) => result[0]?.id);

      if (latestSnapshot) {
        await db
          .update(snapshotsTable)
          .set({ countOps: tokenData.countOps })
          .where(eq(snapshotsTable.id, latestSnapshot));
      } else {
        console.warn(
          `No snapshots found for token contract: ${tokenData.address}`
        );
      }
    } catch (error: any) {
      console.error(
        `Error updating countOps for token ${token.contract}:`,
        error
      );
      if (error.response) {
        if (error.response.status === 404) {
          console.warn(`Token ${token.contract} not found in Ethplorer`);
        } else {
          console.error(
            `Ethplorer API returned error: ${error.response.status} ${error.response.statusText}`
          );
        }
      }
    }
  }
}

const operationsRoutes = new Elysia({ prefix: "/operations" })
  .use(
    cron({
      name: "updateCountOps",
      pattern: "*/3 * * * *",
      context: { offset: 0 },
      async run(self) {
        try {
          const offset = self.cron.updateCountOps.options.context.offset;
          console.log(offset);

          const tokens = await db
            .select()
            .from(tokensTable)
            .where(ne(tokensTable.contract, ""))
            .orderBy(tokensTable.name)
            .limit(10)
            .offset(offset);
          if (tokens.length > 0) {
            await updateCountOpsBatch(tokens);
            console.log("Cron job 'updateCountOps' ran successfully");
            console.log(tokens);
            self.cron.updateCountOps.options.context.offset += 10;
          } else {
            console.log("No tokens found in database.");
            self.cron.updateCountOps.options.context.offset = 0;
          }
        } catch (error) {
          console.error("Error in cron job 'updateCountOps':", error);
        }
      },
    })
  )
  .get(
    "/startFetchingOperations",
    async ({
      store: {
        cron: { updateCountOps },
      },
      set,
    }) => {
      console.log("Cron job 'updateCountOps' status GET request");
      const statusNow = updateCountOps.trigger();

      set.status = 200;
      return statusNow;
    }
  );

export default operationsRoutes;
