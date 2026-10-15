import { describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { CmdbRoutes } from "@/src/route/cmdbRoutes";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { validateDB3PaginatedQueryRequest } from "src/core/db3/server/db3RequestValidation";
import { bandMemberRecoveryQuery, bandUserLifecycleCommand, bandUserLifecycleView } from "src/core/db3/shared/entities/user/bandUserLifecycle";

const membershipId = parsePublicId<"BandUser">("Membership000001");
const edit = { membershipId, action: "deactivate", acknowledgeContinuityRisk: false };

describe("membership lifecycle contracts", () => {
    it("registers a strict membership command and public recovery route", () => {
        expect(getDB3CommandHandler(bandUserLifecycleCommand.commandID).command).toBe(bandUserLifecycleCommand);
        expect(bandUserLifecycleCommand.parseDto(edit)).toEqual(edit);
    });
    it.each([
        { ...edit, membershipId: 1 }, { ...edit, userId: "User000000000001" }, { ...edit, bandId: 1 },
        { ...edit, action: "delete" }, { ...edit, isDeleted: true }, { ...edit, bandRoleId: null },
        { ...edit, acknowledgeContinuityRisk: undefined },
    ])("rejects invalid actions, natural identities and forged account/role fields %#", input => {
        expect(() => bandUserLifecycleCommand.parseDto(input)).toThrow();
    });
    it("returns a typed confirmation rather than pretending that a change was saved", () => {
        expect(bandUserLifecycleCommand.parseResult({ membershipId, isDeleted: true, status: "confirmationRequired", permissions: [Permission.deactivate_users] })).toMatchObject({ status: "confirmationRequired" });
        expect(() => bandUserLifecycleCommand.parseResult({ membershipId, isDeleted: true, status: "confirmationRequired", permissions: [] })).toThrow();
        expect(() => bandUserLifecycleCommand.parseResult({ membershipId, isDeleted: true, status: "confirmationRequired", permissions: ["forged"] })).toThrow();
    });
    it("uses canonical membership selections and strips shared account secrets", () => {
        const dto = bandUserLifecycleView.parseDto({
            publicId: membershipId, userId: "User000000000001",
            user: { publicId: "User000000000001", name: "Alice", email: "private", hashedPassword: "secret" },
            bandRoleId: null, bandRole: null, isDeleted: true,
        });
        expect(dto.user).toEqual({ publicId: "User000000000001", name: "Alice" });
        expect(dto).toMatchObject({ isDeleted: true, bandRoleId: null });
    });
    it("passes explicit band, ordered language inputs, inactive selection and deleted-row authorization through DB3", () => {
        const context = { bandPublicId: parsePublicId<"Band">("Band000000000001"), routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], clientRequestId: "fresh" };
        expect(validateDB3PaginatedQueryRequest(bandMemberRecoveryQuery("alice van damme", 2, context))).toMatchObject({
            ...context, includeDeleted: true, skip: 40, take: 20, orderBy: { user: "asc" },
            filter: { quickFilterValues: ["alice", "van", "damme"], tableParams: { membershipStatus: "inactive" } },
        });
    });
});
