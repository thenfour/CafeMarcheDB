import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    const rawQuery = vi.fn();
    const proxy = new Proxy(authorizationTestDb, {
        get: (target, key) => {
            if (key === "$queryRaw") return rawQuery;
            if (key === "$transaction") return (action: (tx: typeof target) => unknown) => action(proxy);
            return Reflect.get(target, key);
        },
    });
    return { ...prisma, default: proxy };
});

import db from "db";
import type { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { getCalendarWindow } from "shared/dateTimePolicy";
import * as db3 from "src/core/db3/db3";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { GetSearchResultsInput, DiscreteCriterionFilterType, ZGetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { createAuthorizationPersona, createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { eventPublicId } from "../support/eventResponseFixtures";
const rawQuery = vi.mocked(db.$queryRaw as (sql: any) => Promise<any[]>);

const permissions = [Permission.login, Permission.view_users_basic_info, Permission.view_user_contact_info,
    Permission.manage_users, Permission.search_users, Permission.visibility_members, Permission.view_events_nonpublic,
    Permission.recover_users];
const actor = createAuthorizationTestUser("bandAdmin", { id: 901, permissions });
const activeUser = createAuthorizationTestUser("normal", { id: 902, name: "Member Active" });
const deletedUser = createAuthorizationTestUser("normal", { id: 903, name: "Member Deleted", isDeleted: true });
const query = (overrides: Partial<GetSearchResultsInput> = {}): GetSearchResultsInput => ({
    tableID: db3.xUser.tableID, offset: 0, take: 20, quickFilter: "Member",
    sort: [{ db3Column: "name", direction: "asc" }],
    discreteCriteria: [{ db3Column: "role", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] }],
    ...overrides,
});

describe("search recovery capability", () => {
    beforeEach(() => {
        authorizationTestDb.reset({ user: [actor, activeUser, deletedUser] });
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("applies calendar segment overlap to rows, counts and facets alongside visibility", async () => {
        const statements: string[] = [];
        rawQuery.mockImplementation(async (sql: any) => {
            const statement = sql.strings.join("");
            statements.push(statement);
            return /count\(\*\) as rowCount/i.test(statement) ? [{ rowCount: BigInt(0) }] : [];
        });
        await GetSearchResultsCore(query({
            tableID: "Event", quickFilter: "",
            calendarWindow: getCalendarWindow({ startDate: "2026-07-11", endDateExclusive: "2026-07-12" }, "Asia/Tokyo"),
            discreteCriteria: [{ db3Column: "status", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] }],
        }), createAuthorizationTestContext(actor) as AuthenticatedCtx);
        expect(statements.length).toBeGreaterThanOrEqual(3);
        for (const statement of statements) {
            expect(statement).toContain("FROM EventSegment CS");
            expect(statement).toContain("CS.eventId = P.id");
            expect(statement).toContain("2026-07-10 15:00:00.000");
            expect(statement).toContain("P.isDeleted = false");
        }
    });

    it("rejects calendar windows on other search tables before SQL", async () => {
        await expect(GetSearchResultsCore(query({
            calendarWindow: getCalendarWindow({ startDate: "2026-07-11", endDateExclusive: "2026-07-12" }, "UTC"),
        }), createAuthorizationTestContext(actor) as AuthenticatedCtx)).rejects.toThrow("only supported for event searches");
        expect(rawQuery).not.toHaveBeenCalled();
    });

    it("advertises recovery only for users, independently of other table recovery permissions", () => {
        const { schemaAuthorization } = createAuthorizationPersona("sysadmin");
        expect(db3.xUser.getSearchCapabilities(schemaAuthorization)).toEqual({ includeDeleted: true });
        for (const table of [db3.xSong, db3.xEvent, db3.xFile, db3.xWikiPage]) {
            expect(table.getSearchCapabilities(schemaAuthorization)).toEqual({ includeDeleted: false });
        }
        const ordinary = createAuthorizationPersona("normal").schemaAuthorization;
        expect(db3.xUser.getSearchCapabilities(ordinary)).toEqual({ includeDeleted: false });
    });

    it.each([undefined, false, true])("keeps SQL rows, totals, facets and DB3 hydration consistent for includeDeleted=%s", async includeDeleted => {
        const ids = includeDeleted ? [activeUser.id, deletedUser.id] : [activeUser.id];
        const statements: string[] = [];
        rawQuery.mockImplementation(async (sql: any) => {
            const statement = sql.strings.join("");
            statements.push(statement);
            if (/count\(\*\) as rowCount/i.test(statement)) return [{ rowCount: BigInt(ids.length) }];
            if (/limit\s+0,20/i.test(statement)) return ids.map(id => ({ id }));
            return [];
        });
        const result = await GetSearchResultsCore(query({ includeDeleted }), createAuthorizationTestContext(actor) as AuthenticatedCtx);
        expect(result.results.map(row => row.publicId)).toEqual(ids.map(id => id === activeUser.id ? activeUser.publicId : deletedUser.publicId));
        expect(result.results.every(row => !("id" in row))).toBe(true);
        expect(result.rowCount).toBe(ids.length);
        expect(statements.length).toBeGreaterThanOrEqual(3);
        for (const statement of statements) {
            expect(statement.includes("P.isDeleted = false")).toBe(!includeDeleted);
            expect(statement.toLowerCase()).toContain("member");
        }
    });

    it("retains the recovery scope when loading a later page", async () => {
        rawQuery.mockImplementation(async (sql: any) => {
            const statement = sql.strings.join("");
            expect(statement).not.toContain("P.isDeleted = false");
            if (/count\(\*\) as rowCount/i.test(statement)) return [{ rowCount: BigInt(2) }];
            if (/limit\s+1,1/i.test(statement)) return [{ id: deletedUser.id }];
            return [];
        });
        const result = await GetSearchResultsCore(query({ includeDeleted: true, offset: 1, take: 1 }),
            createAuthorizationTestContext(actor) as AuthenticatedCtx);
        expect(result.results).toEqual([expect.objectContaining({ publicId: deletedUser.publicId, isDeleted: true })]);
        expect(result.rowCount).toBe(2);
    });

    it("rejects a forged recovery request before SQL when the current grant was revoked", async () => {
        const ordinary = createAuthorizationTestUser("normal", {
            id: actor.id, permissions: permissions.filter(p => p !== Permission.recover_users),
        });
        authorizationTestDb.reset({ user: [ordinary, deletedUser] });
        await expect(GetSearchResultsCore(query({ includeDeleted: true }), createAuthorizationTestContext(actor) as AuthenticatedCtx))
            .rejects.toMatchObject({ statusCode: 403 });
        expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it.each(["Song", "Event", "File", "WikiPage"])("rejects recovery searches for unenabled %s even for Sysadmin", async tableID => {
        const sysadmin = createAuthorizationTestUser("sysadmin", { id: actor.id });
        authorizationTestDb.reset({ user: [sysadmin] });
        await expect(GetSearchResultsCore(query({ tableID, includeDeleted: true }),
            createAuthorizationTestContext(sysadmin) as AuthenticatedCtx)).rejects.toMatchObject({ statusCode: 403 });
        expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("requires a boolean at the request boundary", () => {
        expect(ZGetSearchResultsInput.parse(query({ includeDeleted: true })).includeDeleted).toBe(true);
        expect(() => ZGetSearchResultsInput.parse({ ...query(), includeDeleted: "true" })).toThrow();
    });

    it("keeps ordinary event searches working without a domain-specific side channel", async () => {
        const event = {
            id: 904, publicId: eventPublicId(904), name: "Member event", isDeleted: false,
            visiblePermissionId: null, createdByUserId: actor.id, expectedAttendanceUserTagId: 905,
        };
        authorizationTestDb.reset({ user: [actor], event: [event], userTag: [] });
        rawQuery.mockImplementation(async (sql: any) => {
            const statement = sql.strings.join("");
            expect(statement).toContain("P.isDeleted = false");
            if (/count\(\*\) as rowCount/i.test(statement)) return [{ rowCount: BigInt(1) }];
            return [{ id: event.id }];
        });
        const result = await GetSearchResultsCore(query({ tableID: "Event", discreteCriteria: [] }),
            createAuthorizationTestContext(actor) as AuthenticatedCtx);
        expect(result.results).toEqual([expect.objectContaining({ publicId: event.publicId })]);
        expect(result.results[0]).not.toHaveProperty("id");
        expect(result).not.toHaveProperty("customData");
    });
});
