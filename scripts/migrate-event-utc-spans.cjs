require("@next/env").loadEnvConfig(process.cwd());
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", jsx: "react-jsx" } });
require("tsconfig-paths/register");
const db = require("../db").default;
const { Prisma } = require("@prisma/client");
const { migrateEventUtcSpans } = require("../src/server/migrateEventUtcSpans");

/*

usage:

node scripts/migrate-event-utc-spans.cjs

options:
  --apply    Actually apply the migration. Without this flag, the script will only simulate the migration.

*/

async function main() {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => arg !== "--apply")) {
        throw new Error("Usage: node scripts/migrate-event-utc-spans.cjs [--apply]");
    }
    const result = await db.$transaction(tx => migrateEventUtcSpans(tx, args.includes("--apply")),
        {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000,
        });
    console.log(JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2));
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => db.$disconnect());
