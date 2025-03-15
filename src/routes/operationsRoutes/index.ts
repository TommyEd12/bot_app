import { Elysia, t } from "elysia";
import { cron } from "@elysiajs/cron";
import { db } from "../../db";

import { desc, eq, ne } from "drizzle-orm";
import { snapshotsTable, tokensTable } from "../../db/schema";
import { ethplorerInstance } from "../../../http";
import { schemaToken, TokenInfo } from "../../types";
import { AuthService } from "../../services/authService";

async function updateCountOpsBatch(tokens: schemaToken[]): Promise<void> {
  //commentedcc
  for (const token of tokens) {
    try {
      const response = await ethplorerInstance.get(
        `/getTokenInfo/${token.contract}`,
        {
          params: { apiKey: process.env.API_KEY },
        }
      );

      const tokenData: TokenInfo = response.data;
      await db.insert(snapshotsTable).values({
        contract: tokenData.address,
        currencyName: tokenData.name,
        price: tokenData.price.rate,
        volume: tokenData.price.marketCapUsd,
        countOps: tokenData.countOps,
        created: new Date(Date.now()),
      });
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
  .use(AuthService)
  .use(
    cron({
      name: "updateCountOps",
      pattern: "*/2 * * * *",
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
  )
  .post(
    "/addToken",
    async ({ body, set }) => {
      try {
        const isTokenExist = await db
          .select()
          .from(tokensTable)
          .where(eq(tokensTable.contract, body.tokenAddress));
        if (isTokenExist.length > 0) {
          throw new Error("Данный токен уже есть в нашей базе!");
        }
        const response = await ethplorerInstance.get(
          `/getTokenInfo/${body.tokenAddress}`,
          {
            params: { apiKey: process.env.API_KEY },
          }
        );
        if (!response.data) {
          throw new Error("Такого контракта нет в базе Ethplorer");
        }

        const tokenData: TokenInfo = response.data;

        await db
          .insert(tokensTable)
          .values({ name: tokenData.name, contract: tokenData.address });
        const res = await db.insert(snapshotsTable).values({
          contract: tokenData.address,
          currencyName: tokenData.name,
          price: tokenData.price.rate,
          volume: tokenData.price.marketCapUsd,
          countOps: tokenData.countOps,
          created: new Date(Date.now()),
        });
        
        return res;
      } catch (e) {
        set.status = 500;
        return (e as Error).message;
      }
    },
    {
      body: t.Object({
        tokenAddress: t.String(),
      }),
      isSignIn:true 
    }, 
  );

export default operationsRoutes;
