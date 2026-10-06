// Previews by default.
// --apply writes them atomically
//
// node scripts/recalculate-event-date-bounds.cjs [--apply]

// this script takes into account the band's timezone, and recalculates and rewrites
// event date bounds based on the union of its segments. it does this for every event
// it's effectively the thing that gets run in the mutation hook for events/event segments.
//
// Q: why don't we also correct the segments?
//    this is not a migration for datetime policy change; it's a "trust the segment
//    date range, and calculate the event to be in sync"
// Q: what exact scenario is this correcting for / what change necessitates this?
//    dateTimeAudit.md -- mostly, the introduction of bandTimeZone means all-day
//    events' UTC representation need to be shifted. It may not be necessary to
//    run this script; it was introduced somewhere together with `migrate-event-utc-spans.cjs`,
//    which actually does the migration and should put everything in sync.

require("@next/env").loadEnvConfig(process.cwd());
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", jsx: "react-jsx" } });
require("tsconfig-paths/register");
const db = require("../db").default;
const { Prisma } = require("@prisma/client");
const { calculateEventDateBoundsUpdatePatch, fetchCancelledEventStatusIds } = require("../src/server/dateTime");

const serialize = value => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);

async function main() {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== "--apply") || args.length > 1) throw new Error("Usage: node scripts/recalculate-event-date-bounds.cjs [--apply]");
    const apply = args.includes("--apply");
    const result = await db.$transaction(async tx => {
        const events = await tx.event.findMany({
            orderBy: { id: "asc" },
            select: {
                id: true,
                startsAt: true,
                durationMillis: true,
                isAllDay: true,
                endDateTime: true,
            }
        });
        const cancelledStatusIds = await fetchCancelledEventStatusIds(tx);
        const changes = [];
        for (const event of events) {
            const update = await calculateEventDateBoundsUpdatePatch(tx, event.id, cancelledStatusIds);
            if (!update) {
                throw new Error(`Event ID ${event.id} returned unexpected empty calculateEventDateBoundsUpdatePatch`);
            }
            const before = {};
            const after = {};

            // sanitize fields and only update ones which are different
            for (const [key, value] of Object.entries(update)) {
                // Prisma reads BIGINT durations but accepts a number when writing.
                if (serialize(key === "durationMillis" ? String(event[key]) : event[key]) === serialize(key === "durationMillis" ? String(value) : value)) {
                    continue;
                }
                before[key] = event[key];
                after[key] = value;
            }

            if (Object.keys(after).length === 0) {
                continue;
            }
            changes.push({ eventId: event.id, before, after });
            if (apply) {
                await tx.event.update({
                    where: { id: event.id },
                    data: update
                });
            }
        }
        return { mode: apply ? "applied" : "dry-run", inspected: events.length, changed: changes.length, changes };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
    console.log(serialize(result));
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => db.$disconnect());
