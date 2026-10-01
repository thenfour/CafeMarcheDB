require("@next/env").loadEnvConfig(process.cwd());
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", jsx: "react-jsx" } });
require("tsconfig-paths/register");
const db = require("../db").default;
const { Prisma } = require("@prisma/client");
const { migrateEventUtcSpans } = require("../src/server/migrateEventUtcSpans");

/*

This recalculates all-day events UTC representations based off band timezone,
after the introduction of the band timezone feature.

Legacy all-day representation is indicated by the `eventSegment.dateTimeVersion`
where:

1 = legacy all-day representation (all-day means starting at midnight UTC)
2 = new all-day representation (all-day means starting at midnight in the band's timezone)

Changing from 1 to 2 means shifting the all-day event's start time from midnight UTC to midnight in the band's timezone.

Rewrites
- EventSegment date fields
- Event date fields

Consequence of not running this is that all-day events may not line up with the
canonical representation (re-setting to the same time would change it...)

Running this on an already-migrated database is a NOP due to the dateTimeVersion field.

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
