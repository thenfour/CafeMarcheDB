import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { SetRoleDesignationInput } from "src/auth/roleDesignations";
import { AssignUserRoleInput } from "src/auth/mutations/assignUserRole";
import { bandRoleEditorView, globalRoleEditorView } from "src/core/db3/shared/entities/user/roleViews";
import { setBandRolePermissionCommand, setGlobalRolePermissionCommand } from "src/core/db3/shared/entities/user/rolePermissionCommands";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { userEditorView } from "src/core/db3/shared/entities/user/userViews";
import { platformUserEditorView } from "src/core/db3/shared/entities/user/platformUser";
import { platformUserAccountCreateCommandHandler, userAccountCreateCommandHandler } from "src/core/db3/server/commands/userAccountCreateCommands";

const globalRole = parsePublicId<"GlobalRole">("GlobalRole000001");
const bandRole = parsePublicId<"BandRole">("BandRole00000001");
const userId = parsePublicId<"User">("Account000000001");

describe("role administration request boundaries", () => {
    it.each([
        { view: userEditorView, handler: userAccountCreateCommandHandler },
        { view: platformUserEditorView, handler: platformUserAccountCreateCommandHandler },
    ])("keeps account creation under its lifecycle owner when another CRUD operation is generated: $view.viewID", ({ view, handler }) => {
        getDB3CommandHandler(view.crud.operations.update.command.commandID);
        expect(getDB3CommandHandler(view.crud.operations.create.command.commandID)).toBe(handler);
    });
    it.each([
        { scope: "global", designation: "sysadmin", roleId: globalRole },
        { scope: "global", designation: "public", roleId: globalRole },
        { scope: "global", designation: "newUsers", roleId: globalRole },
        { scope: "band", designation: "public", roleId: bandRole },
        { scope: "band", designation: "newUsers", roleId: bandRole },
    ])("accepts the migrated $scope/$designation designation", edit => {
        expect(SetRoleDesignationInput.parse(edit)).toEqual(edit);
    });
    it.each([
        { scope: "band", designation: "sysadmin", roleId: bandRole },
        { designation: "public", roleId: bandRole },
        { scope: "band", designation: "public", roleId: 12 },
        { scope: "band", designation: "public", roleId: bandRole, bandId: 1 },
        { scope: "band", designation: "public", roleId: bandRole, isPublicRole: true },
    ])("rejects ambiguous or forged designations %#", edit => {
        expect(() => SetRoleDesignationInput.parse(edit)).toThrow();
    });
    it.each([globalRole, null])("requires explicit continuity policy for account role %s", roleId => {
        expect(AssignUserRoleInput.parse({ userId, roleId, acknowledgeContinuityRisk: false })).toEqual({ userId, roleId, acknowledgeContinuityRisk: false });
        expect(() => AssignUserRoleInput.parse({ userId, roleId })).toThrow();
        expect(() => AssignUserRoleInput.parse({ userId, roleId, acknowledgeContinuityRisk: false, bandId: 1 })).toThrow();
    });
    it.each([globalRoleEditorView, bandRoleEditorView])("keeps singleton and deletion flags out of generic writes: $viewID", view => {
        const command = view.crud.operations.update.command;
        for (const flag of ["isRoleForNewUsers", "isPublicRole", "isDeleted", "isSysAdminRole"]) {
            expect(() => command.parseDto({ identity: globalRole, patch: { [flag]: true } })).toThrow();
        }
        expect(view.crud.operations.delete).toBeUndefined();
    });
    it.each([setGlobalRolePermissionCommand, setBandRolePermissionCommand])("registers strict public association commands: $commandID", command => {
        expect(getDB3CommandHandler(command.commandID).command).toBe(command);
        const request = { localIdentity: "Permission000001", foreignIdentity: bandRole, isAssociated: true };
        expect(command.parseDto(request)).toEqual(request);
        expect(() => command.parseDto({ ...request, localIdentity: 1 })).toThrow();
        expect(() => command.parseDto({ ...request, userId })).toThrow();
    });
});
