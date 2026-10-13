import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { bandUserIdentityView, bandUserProfileCommand } from "src/core/db3/shared/entities/user/bandUserProfile";
import { xBandUser } from "src/core/db3/shared/entities/user/bandUser";
import { bandMemberDirectoryQuery, type BandMemberDirectoryFilter } from "src/core/db3/shared/entities/user/bandUserDirectoryQuery";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { validateDB3PaginatedQueryRequest } from "src/core/db3/server/db3RequestValidation";
import { bandMemberHref } from "src/core/components/user/bandMemberLinks";

const membershipId = parsePublicId<"BandUser">("Membership000001");
const edit = { membershipId, name: "Alice", phone: "+32 123" };
const context = { bandPublicId: parsePublicId<"Band">("Band000000000001"), routeLocale: "fr-BE", browserLanguages: ["nl-BE"], clientRequestId: "refresh" };
const filters: BandMemberDirectoryFilter = { search: "alice van damme", tagId: "", instrumentId: "", roleId: "", order: "nameAsc", page: 0 };

describe("member profile and directory contracts", () => {
    it("registers the profile command and normalizes display edits while preserving an omitted phone", () => {
        expect(getDB3CommandHandler(bandUserProfileCommand.commandID).command).toBe(bandUserProfileCommand);
        expect(bandUserProfileCommand.serialize({ ...edit, name: " Alice ", phone: " +32 123 " })).toEqual(edit);
        expect(bandUserProfileCommand.serialize({ membershipId, name: "Alice" })).not.toHaveProperty("phone");
    });
    it.each([
        { ...edit, membershipId: 1 }, { ...edit, name: "   " }, { ...edit, name: "a".repeat(769) },
        { ...edit, phone: "p".repeat(769) }, { ...edit, email: "forged@test.invalid" },
        { ...edit, bandId: 1 }, { ...edit, userId: "User000000000001" },
        { ...edit, globalRoleId: "GlobalRole000001" }, { ...edit, isSysAdmin: true }, { ...edit, bandRoleId: null },
    ])("rejects malformed profile changes and ownership/credential/grant fields %#", input => {
        expect(() => bandUserProfileCommand.parseDto(input)).toThrow();
    });
    it("derives a minimal public person lookup instead of a legacy account payload", () => {
        const dto = bandUserIdentityView.parseDto({ publicId: membershipId, user: { publicId: "User000000000001", name: "Alice", email: "private@test.invalid" } });
        expect(dto).toEqual({ publicId: membershipId, user: { publicId: "User000000000001", name: "Alice" } });
    });
    it("validates public catalog predicates with every presentation hint and tokenized names", () => {
        const query = validateDB3PaginatedQueryRequest(bandMemberDirectoryQuery({ ...filters,
            tagId: "UserTag000000001", instrumentId: "Instrument000001", roleId: "unassigned", page: 2,
        }, context, false));
        expect(query).toMatchObject({ ...context, skip: 40, take: 20, orderBy: { user: "asc" },
            filter: { quickFilterValues: ["alice", "van", "damme"], tableParams: { tagId: "UserTag000000001", instrumentId: "Instrument000001", roleId: null } } });
        expect(() => bandMemberDirectoryQuery({ ...filters, tagId: "123" }, context, false)).toThrow();
    });
    it("selects membership creation-date order only for managers", () => {
        expect(bandMemberDirectoryQuery({ ...filters, order: "joinedDesc" }, context, true).orderBy).toEqual({ createdAt: "desc" });
        expect(bandMemberDirectoryQuery({ ...filters, order: "joinedDesc" }, context, false).orderBy).toEqual({ user: "desc" });
        expect(xBandUser.getPrismaOrderBy({ user: "asc" })).toEqual([{ user: { name: "asc" } }, { publicId: "asc" }]);
        // Scalar foreign-key ordering remains valid when relation display ordering is available.
        expect(xBandUser.getPrismaOrderBy({ bandRoleId: "desc" })).toEqual([{ bandRoleId: "desc" }, { publicId: "asc" }]);
    });
    it("keeps person identity, band and route locale in profile links", () => {
        expect(bandMemberHref(parsePublicId<"User">("User000000000001"), context, { kind: "platform" })).toBe("/fr-BE/b/Band000000000001/backstage/user/User000000000001");
    });
});
