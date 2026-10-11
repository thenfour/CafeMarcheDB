import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { bandUserRoleCommand, bandUserRolesView } from "src/core/db3/shared/entities/user/bandUserRoles";
import { bandRoleListView, xBandRole } from "src/core/db3/shared/entities/user/bandRoleViews";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";

const membershipId = parsePublicId<"BandUser">("Membership000001");
const roleId = parsePublicId<"BandRole">("BandRole00000001");
const edit = { membershipId, roleId, acknowledgeContinuityRisk: false };

describe("membership role transport", () => {
    it("registers strict membership assignment and explicit reset to new-member defaults", () => {
        expect(getDB3CommandHandler(bandUserRoleCommand.commandID).command).toBe(bandUserRoleCommand);
        expect(bandUserRoleCommand.serialize(edit)).toEqual(edit);
        expect(bandUserRoleCommand.serialize({ ...edit, roleId: null })).toEqual({ ...edit, roleId: null });
    });
    it.each([
        { ...edit, membershipId: 12 }, { ...edit, roleId: 12 }, { membershipId, roleId },
        { ...edit, userId: "User000000000001" }, { ...edit, bandId: 1 }, { ...edit, globalRoleId: roleId },
    ])("rejects malformed identities and undeclared ownership/account fields %#", input => {
        expect(() => bandUserRoleCommand.parseDto(input)).toThrow();
    });
    it("makes confirmation a typed result before any mutation", () => {
        expect(bandUserRoleCommand.parseResult({ membershipId, roleId, status: "confirmationRequired", permissions: [Permission.assign_user_roles] })).toMatchObject({ status: "confirmationRequired" });
        expect(() => bandUserRoleCommand.parseResult({ membershipId, roleId, status: "confirmationRequired", permissions: [] })).toThrow();
    });
    it("derives public membership/role references and reserves definition editing for Sysadmins", () => {
        expect(bandUserRolesView.parseDto({
            publicId: membershipId, userId: "User000000000001", user: { publicId: "User000000000001", name: "Alice" },
            bandRoleId: roleId, bandRole: { publicId: roleId }
        })).toMatchObject({ bandRoleId: roleId });
        expect(bandRoleListView.tableID).toBe("BandRole");
        expect(xBandRole.tableAuthMap.Edit).toBe(Permission.sysadmin);
    });
});
