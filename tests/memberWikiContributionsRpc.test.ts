import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as PrismaModule from "@prisma/client";
import type * as AuthorizationModule from "src/auth/server/serverAuthorization";
import { parsePublicId } from "shared/publicId";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";
import { CMServerAuthorization, loadAuthorization } from "src/auth/server/serverAuthorization";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { readUserWikiContributions } from "src/core/wiki/server/userWikiContributions";
import getContributions from "src/core/db3/queries/getUserWikiContributions";

vi.mock("db", async () => ({ ...await vi.importActual<typeof PrismaModule>("@prisma/client"), default: {} }));
vi.mock("src/auth/server/serverAuthorization", async () => {
    const actual = await vi.importActual<typeof AuthorizationModule>("src/auth/server/serverAuthorization");
    return { ...actual, loadAuthorization: vi.fn() };
});
vi.mock("src/core/wiki/server/userWikiContributions", () => ({ readUserWikiContributions: vi.fn() }));

const ctx = createAuthorizationTestContext(createAuthorizationTestUser("normal"));
const input = { bandPublicId: parsePublicId<"Band">("ProfileBand00001"), userId: parsePublicId<"User">("ProfilePerson001") };
const authorization = new CMServerAuthorization(null, new ServerPermissionSet([]));

describe("profile Wiki contribution request boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(loadAuthorization).mockResolvedValue(authorization);
    });

    it.each([null, {}, { ...input, bandPublicId: null }, { ...input, bandPublicId: 1 }, { ...input, userId: 1 },
        { ...input, userId: "123" }, { ...input, bandId: 1 }, { ...input, createdByUserId: 1 }, { ...input, userId: undefined },
    ])("rejects invalid or unscoped input before loading any authorization or data: %j", async request => {
        await expect(invokeResolver(getContributions, request, ctx)).rejects.toThrow();
        expect(loadAuthorization).not.toHaveBeenCalled();
        expect(readUserWikiContributions).not.toHaveBeenCalled();
    });

    it("forwards the explicit band and shared person to the existing authorized reader", async () => {
        const result = { wikiContributions: [] };
        vi.mocked(readUserWikiContributions).mockResolvedValue(result);
        expect(await invokeResolver(getContributions, input, ctx)).toEqual(result);
        expect(loadAuthorization).toHaveBeenCalledWith(ctx.session, input.bandPublicId);
        expect(readUserWikiContributions).toHaveBeenCalledWith({}, authorization, input);
    });
});
