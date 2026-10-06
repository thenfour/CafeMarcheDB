import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { settingsMysqlTestUrl } from "./support/settingsMysqlFixture";

function migrationDatabaseUrl(): string | undefined {
    if (!settingsMysqlTestUrl) return undefined;
    const url = new URL(settingsMysqlTestUrl);
    // Temporary tables in the actual migration require one connection.
    url.searchParams.set("connection_limit", "1");
    return url.toString();
}

const testUrl = migrationDatabaseUrl();
const database = new PrismaClient(testUrl ? { datasources: { db: { url: testUrl } } } : undefined);

async function applyLatestMigration(): Promise<void> {
    const sql = readFileSync(resolve("db/migrations/20261005120000_696_authorization_foundation/migration.sql"), "utf8");
    // This checked-in migration has no statement delimiters inside SQL literals.
    const statements = sql.replace(/^\s*--.*$/gm, "").split(";").map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) {
        // Execute reviewed repository SQL, without interpolating external input.
        await database.$executeRawUnsafe(statement);
    }
}

describe.skipIf(!testUrl)("settings column correction on MariaDB/MySQL", () => {
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    it("applies the existing latest migration and preserves serialized JSON documents", async () => {
        const name = await database.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
        const band = await database.band.create({ data: { publicId: generatePublicId(), nameId: name.id } });
        const prefix = `column-correction-${generatePublicId()}`;
        const values: Prisma.JsonValue[] = ["", "false", "123", false, 0, null, { nested: [false, null, "text"] }, [1, "2"]];
        // DDL commits implicitly. The URL guard above restricts this test to a disposable database.
        try {
            await database.$executeRaw`ALTER TABLE GlobalSetting MODIFY value MEDIUMTEXT NOT NULL`;
            await database.$executeRaw`ALTER TABLE BandSetting MODIFY value MEDIUMTEXT NOT NULL`;
            for (const [index, value] of values.entries()) {
                const key = `${prefix}-${index}`, serialized = JSON.stringify(value);
                await database.$executeRaw`INSERT INTO GlobalSetting (publicId, name, value, updatedAt)
                    VALUES (${generatePublicId()}, ${key}, ${serialized}, NOW(3))`;
                await database.$executeRaw`INSERT INTO BandSetting (publicId, bandId, name, value, updatedAt)
                    VALUES (${generatePublicId()}, ${band.id}, ${key}, ${serialized}, NOW(3))`;
            }
            await applyLatestMigration();
            const global = await database.globalSetting.findMany({ where: { name: { startsWith: prefix } }, orderBy: { name: "asc" } });
            const scoped = await database.bandSetting.findMany({ where: { bandId: band.id }, orderBy: { name: "asc" } });
            expect(global.map(row => row.value)).toEqual(values);
            expect(scoped.map(row => row.value)).toEqual(values);
        } finally {
            await database.$executeRaw`ALTER TABLE GlobalSetting MODIFY value JSON NOT NULL`;
            await database.$executeRaw`ALTER TABLE BandSetting MODIFY value JSON NOT NULL`;
            await database.globalSetting.deleteMany({ where: { name: { startsWith: prefix } } });
            await database.band.delete({ where: { id: band.id } });
            await database.dynamicLocalizedString.delete({ where: { id: name.id } });
        }
    }, 30_000);
});
