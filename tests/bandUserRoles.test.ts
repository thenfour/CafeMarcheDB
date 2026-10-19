import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { bandUserRoleCommand, bandUserRolesView } from "src/core/db3/shared/entities/user/bandUserRoles";
import { bandRoleListView, xBandRole } from "src/core/db3/shared/entities/user/bandRoleViews";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { canDelegateBandRoleGrants } from "src/auth/shared/bandRolePolicy";
import { CMClientAuthorization } from "src/auth/shared/cmAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";

const membershipId = parsePublicId<"BandUser">("Membership000001");
const roleId = parsePublicId<"BandRole">("BandRole00000001");
const edit = { membershipId, roleId, acknowledgeContinuityRisk: false };

describe("membership role transport", () => {
    it("confines global band delegation to known band grants in an explicit band context", () => {
        const grants = new PermissionSet([Permission.global_band_admin]);
        const unscoped = new CMClientAuthorization(null, grants);
        const scoped = new CMClientAuthorization(null, grants, null, parsePublicId<"Band">("Band000000000001"));
        expect(canDelegateBandRoleGrants(unscoped, [Permission.manage_events])).toBe(false);
        expect(canDelegateBandRoleGrants(scoped, [Permission.manage_events])).toBe(true);
        expect(canDelegateBandRoleGrants(scoped, [Permission.manage_global_users])).toBe(false);
        expect(canDelegateBandRoleGrants(scoped, ["unknown_band_permission"])).toBe(false);
        expect(scoped.hasPermission(Permission.manage_events)).toBe(false);
        expect(grants.hasAllDelegable(new PermissionSet([Permission.manage_events]))).toBe(false);
    });
    it("registers strict membership assignment and explicit reset to Band Public", () => {
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
