// Preview derived event corrections by default. --apply writes them atomically.
// node scripts/recalculate-event-date-bounds.cjs [--apply]
require("@next/env").loadEnvConfig(process.cwd());
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", jsx: "react-jsx" } });
require("tsconfig-paths/register");
const db = require("../db").default;
const { Prisma } = require("@prisma/client");
const { loadBandTimeZone, calculateEventDateBounds } = require("../src/server/dateTime");

const serialize = value => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);

async function main() {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== "--apply") || args.length > 1) throw new Error("Usage: node scripts/recalculate-event-date-bounds.cjs [--apply]");
    const apply = args.includes("--apply");
    const result = await db.$transaction(async tx => {
        const timeZone = await loadBandTimeZone(tx);
        const events = await tx.event.findMany({
            orderBy: { id: "asc" },
            select: {
                id: true, startsAt: true, durationMillis: true, isAllDay: true, endDateTime: true,
            }
        });
        const changes = [];
        for (const event of events) {
            const update = await calculateEventDateBounds(tx, event.id);
            if (!update) continue;
            const before = {};
            const after = {};
            for (const [key, value] of Object.entries(update)) {
                // Prisma reads BIGINT durations but accepts a number when writing.
                if (serialize(key === "durationMillis" ? String(event[key]) : event[key]) === serialize(key === "durationMillis" ? String(value) : value)) {
                    continue;
                }
                before[key] = event[key];
                after[key] = value;
            }
            if (Object.keys(after).length === 0) continue;
            changes.push({ eventId: event.id, before, after });
            if (apply) await tx.event.update({ where: { id: event.id }, data: update });
        }
        return { mode: apply ? "applied" : "dry-run", timeZone, inspected: events.length, changed: changes.length, changes };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
    console.log(serialize(result));
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => db.$disconnect());
