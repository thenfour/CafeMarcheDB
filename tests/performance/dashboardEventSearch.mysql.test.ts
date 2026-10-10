import { PrismaClient, type Prisma, type EventStatus } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { gMillisecondsPerDay } from "shared/time";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { readDashboardRelevantEvents } from "src/core/db3/server/dashboardEvents";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { gEventRelevanceClass } from "src/core/db3/shared/eventRelevance";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "../support/settingsMysqlFixture";
import { historicalDashboardRelevance } from "./support/historicalDashboardRelevance";

const enabled = process.env.CMDB_RUN_DASHBOARD_RELEVANCE_BENCHMARK === "1" && !!settingsMysqlTestUrl;
const now = new Date("2026-10-10T12:00:00Z");
const warmups = 10, iterations = 50;

interface Measurement {
    readonly wallMillis: number;
    readonly sqlMillis: number;
    readonly queries: number;
}

function statistics(measurements: readonly Measurement[]) {
    const percentile = (values: number[], fraction: number) => values.sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]!;
    const rounded = (value: number) => Math.round(value * 1000) / 1000;
    return {
        medianMillis: rounded(percentile(measurements.map(value => value.wallMillis), 0.5)),
        p95Millis: rounded(percentile(measurements.map(value => value.wallMillis), 0.95)),
        medianSqlMillis: rounded(percentile(measurements.map(value => value.sqlMillis), 0.5)),
        queries: [...new Set(measurements.map(value => value.queries))],
    };
}

async function seedEvents(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, size: number) {
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const cancelled: EventStatus = await tx.eventStatus.create({ data: { publicId: generatePublicId(),
        name: { create: { publicId: generatePublicId() } }, description: { create: { publicId: generatePublicId(), format: "Markdown" } },
        significance: "Cancelled", isDeleted: true,
    } });
    for (const band of fixture.bands) {
        const data: Prisma.EventCreateManyInput[] = Array.from({ length: size }, (_, index) => {
            const dayOffset = index === 0 ? -10 : index === 1 ? 30 : ((index * 97) % 730) - 365;
            const startsAt = new Date(now.valueOf() + dayOffset * gMillisecondsPerDay + (index % 24) * 3_600_000);
            const undated = index === 2 || (index > 2 && index % 37 === 0);
            const durationMillis = BigInt(index % 4 === 0 ? gMillisecondsPerDay : 3_600_000);
            return {
                publicId: generatePublicId(), bandId: band.id, name: `Benchmark Event ${index}`, revision: 1,
                createdByUserId: index % 20 === 0 ? fixture.user.id : fixture.admin.id,
                visiblePermissionId: index % 10 === 0 ? null : visibility.id,
                isDeleted: index > 2 && index % 23 === 0, isAllDay: index % 4 === 0,
                startsAt: undated ? null : startsAt,
                durationMillis, endDateTime: undated ? null : new Date(startsAt.valueOf() + Number(durationMillis)),
                relevanceClassOverride: index < 3 ? gEventRelevanceClass.Pinned : index % 29 === 0 ? gEventRelevanceClass.Hidden : null,
                statusId: index % 19 === 0 ? cancelled.id : null,
            };
        });
        // Bound statement size while keeping the population outside measured operations.
        for (let offset = 0; offset < data.length; offset += 1000) {
            await tx.event.createMany({ data: data.slice(offset, offset + 1000) });
        }
    }
}

describe.skipIf(!enabled)("documented dashboard relevance search benchmark", () => {
    const database = new PrismaClient({ datasourceUrl: settingsMysqlTestUrl, log: [{ emit: "event", level: "query" }] });
    const queries: Prisma.QueryEvent[] = [];
    database.$on("query", query => queries.push(query));
    beforeAll(async () => {
        await initializeAccessControl(database);
        const version = await database.$queryRaw<Array<{ version: string }>>`SELECT VERSION() version`;
        console.log("Dashboard relevance benchmark environment:", JSON.stringify({
            database: version[0]!.version, node: process.version, platform: process.platform, warmups, iterations,
            selectedBandSizes: [100, 1000, 10000], foreignBandSize: "same as selected", clock: now.toISOString(),
        }));
    }, 30_000);
    afterAll(() => database.$disconnect());

    it.each([100, 1000, 10000])("compares the same authorized snapshot with %i Events in each of two bands", size =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            await seedEvents(tx, fixture, size);
            const bandPublicId = parsePublicId<"Band">(fixture.bands[0]!.publicId);
            const authorization = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
            const context = await bindDB3ReadSnapshot(tx, authorization, { isolationLevel: "Serializable" });
            const baseline = () => historicalDashboardRelevance(context, now);
            const sharedSearch = () => readDashboardRelevantEvents(context, now);
            const expected = await baseline();
            expect(expected.length).toBeGreaterThan(0);
            const measure = async (read: typeof baseline): Promise<Measurement> => {
                const queryStart = queries.length;
                const start = performance.now();
                const result = await read();
                const wallMillis = performance.now() - start;
                const executed = queries.slice(queryStart);
                expect(result).toEqual(expected);
                return { wallMillis, sqlMillis: executed.reduce((sum, query) => sum + query.duration, 0), queries: executed.length };
            };
            for (let index = 0; index < warmups; index++) {
                await measure(baseline);
                await measure(sharedSearch);
            }
            const oldMeasurements: Measurement[] = [], searchMeasurements: Measurement[] = [];
            for (let index = 0; index < iterations; index++) {
                // Alternate first-run order to reduce drift and shared-cache bias.
                if (index % 2 === 0) {
                    oldMeasurements.push(await measure(baseline));
                    searchMeasurements.push(await measure(sharedSearch));
                } else {
                    searchMeasurements.push(await measure(sharedSearch));
                    oldMeasurements.push(await measure(baseline));
                }
            }
            console.log("Dashboard relevance benchmark:", JSON.stringify({
                selectedBandEvents: size, totalEvents: size * 2, results: expected.length,
                baseline: statistics(oldMeasurements), sharedSearch: statistics(searchMeasurements), identicalResults: true,
            }));
        }), 60_000);
});
