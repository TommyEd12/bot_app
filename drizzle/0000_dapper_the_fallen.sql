CREATE TABLE "snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"contract" varchar,
	"currencyName" varchar,
	"price" real,
	"volume" real,
	"countOps" integer,
	"created" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"contract" varchar,
	"name" varchar(255) PRIMARY KEY NOT NULL,
	CONSTRAINT "tokens_contract_unique" UNIQUE("contract")
);
--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_contract_tokens_contract_fk" FOREIGN KEY ("contract") REFERENCES "public"."tokens"("contract") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_currencyName_tokens_name_fk" FOREIGN KEY ("currencyName") REFERENCES "public"."tokens"("name") ON DELETE no action ON UPDATE no action;