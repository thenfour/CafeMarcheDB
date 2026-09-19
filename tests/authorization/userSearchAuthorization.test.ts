import type { AuthenticatedCtx } from "blitz";
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
import { Permission } from "shared/permissions";
import * as db3 from "src/core/db3/db3";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { DiscreteCriterionFilterType, type GetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";

const rawQuery = vi.mocked(db.$queryRaw as (sql: unknown) => Promise<unknown[]>);

const makeActor = (id: number, permissions: Permission[]) => createAuthorizationTestUser("normal", {
    id,
    permissions: [Permission.login, Permission.search_users, Permission.view_users_basic_info, ...permissions],
});

const query = (overrides: Partial<GetSearchResultsInput> = {}): GetSearchResultsInput => ({
    tableID: db3.xUser.tableID,
    offset: 0,
    take: 20,
    quickFilter: "signin-only@test.invalid",
    sort: [{ db3Column: "name", direction: "asc" }],
    // The users page submits disabled filters as alwaysMatch. The server must
    // ignore an unreadable disabled criterion rather than returning its facets.
    discreteCriteria: [{ db3Column: "role", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] }],
    ...overrides,
});

const runSearch = async (
    actor: ReturnType<typeof makeActor>,
    resultUsers: ReturnType<typeof createAuthorizationTestUser>[] = [],
) => {
    authorizationTestDb.reset({ user: [actor, ...resultUsers] });
    rawQuery.mockImplementation(async (sql: any) => {
        const statement = sql.strings.join("");
        if (/count\(\*\) as rowCount/i.test(statement)) return [{ rowCount: BigInt(resultUsers.length) }];
        if (/limit\s+0,20/i.test(statement)) return resultUsers.map(user => ({ id: user.id }));
        return [];
    });
    return GetSearchResultsCore(
        query(),
        createAuthorizationTestContext(actor) as AuthenticatedCtx,
    );
};

const getFilterSql = async (actor: ReturnType<typeof makeActor>) =>
    (await runSearch(actor)).filterQueryResult.sqlSelect;

describe("user search field authorization", () => {
    beforeEach(() => {
        rawQuery.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("does not search contact or sign-in email fields for a basic directory viewer", async () => {
        const sql = await getFilterSql(makeActor(1_301, []));

        expect(sql).not.toContain("email like");
        expect(sql).not.toContain("UserSignInMethod");
    });

    it("searches contact email, but not sign-in email, with contact visibility", async () => {
        const sql = await getFilterSql(makeActor(1_302, [Permission.view_user_contact_info]));

        expect(sql).toContain("email like");
        expect(sql).not.toContain("UserSignInMethod");
    });

    it("searches email sign-in methods for user maintainers without exposing them in the payload", async () => {
        const actor = makeActor(1_303, [Permission.view_user_contact_info, Permission.manage_users]);
        const target = {
            ...createAuthorizationTestUser("normal", { id: 1_305, email: "contact@test.invalid" }),
            signInMethods: [{ id: 1, type: "email", identifier: "signin-only@test.invalid" }],
        };
        const result = await runSearch(actor, [target]);
        const sql = result.filterQueryResult.sqlSelect;

        expect(sql).toContain("FROM UserSignInMethod signInMethod");
        expect(sql).toContain("signInMethod.type = 'email'");
        expect(sql).toContain("signInMethod.identifier LIKE '%signin-only@test.invalid%'");
        expect(result.results).toEqual([expect.objectContaining({ id: target.id })]);
        expect(result.results[0]).not.toHaveProperty("signInMethods");
    });

    it("rejects explicit sorting and filtering by unreadable operational fields", async () => {
        const actor = makeActor(1_304, []);
        authorizationTestDb.reset({ user: [actor] });

        await expect(GetSearchResultsCore(
            query({ sort: [{ db3Column: "createdAt", direction: "desc" }] }),
            createAuthorizationTestContext(actor) as AuthenticatedCtx,
        )).rejects.toMatchObject({ statusCode: 403 });
        await expect(GetSearchResultsCore(
            query({ discreteCriteria: [{ db3Column: "role", behavior: DiscreteCriterionFilterType.hasSomeOf, options: [1] }] }),
            createAuthorizationTestContext(actor) as AuthenticatedCtx,
        )).rejects.toMatchObject({ statusCode: 403 });
        expect(rawQuery).not.toHaveBeenCalled();
    });
});
