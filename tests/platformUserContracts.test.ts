import { describe, expect, expectTypeOf, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId, type UserPublicId } from "shared/publicId";
import { getBackstageRoute } from "src/auth/shared/backstageRoutes";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import * as db3 from "src/core/db3/db3";
import { authorizeAndProjectViewDto } from "src/core/db3/server/db3QueryCore";
import { testServerAuthorization } from "./support/serverAuthorization";

const person = {
    id: 10, publicId: parsePublicId<"User">("PlatformUser0001"), name: "Shared person",
    email: "person@example.test", phone: "+32 123", cssClass: null,
    createdAt: new Date("2026-10-01T12:00:00Z"), isSysAdmin: false, isDeleted: false,
};
const authorize = (actorId: number, ...permissions: Permission[]) => testServerAuthorization(
    { id: actorId }, new ServerPermissionSet(permissions.map((name, index) => ({ id: index + 1, name }))),
);
const platform = authorize(1, Permission.login, Permission.manage_global_users);
const bandManager = authorize(20, Permission.login, Permission.manage_users, Permission.view_users_basic_info, Permission.view_user_contact_info);

describe("platform account maintenance contract", () => {
    it("uses the platform capability on the page and table, including for the account owner", () => {
        expect(getBackstageRoute("adminUsers").permission).toBe(Permission.manage_global_users);
        expect(db3.xPlatformUser.authorizeTableForView(platform)).toBe(true);
        for (const auth of [bandManager, authorize(person.id, Permission.login), authorize(1, Permission.sysadmin), testServerAuthorization(null, new ServerPermissionSet([]))]) {
            expect(db3.xPlatformUser.authorizeTableForView(auth)).toBe(false);
            expect(db3.xPlatformUser.authorizeRowForView({ model: person, auth })).toBe(false);
            expect(db3.xPlatformUser.authorizeRowForEdit({ model: person, auth })).toBe(false);
        }
        expect(db3.xPlatformUser.requiresReadSnapshot).toBe(true);
    });

    it("returns complete person details with public identity and no credentials or membership data", () => {
        type Dto = db3.DtoOf<typeof db3.platformUserEditorView>;
        expectTypeOf<Dto["publicId"]>().toEqualTypeOf<UserPublicId>();
        expectTypeOf<Extract<keyof Dto, "id" | "globalRoleId" | "bandId" | "instruments" | "tags" | "hashedPassword">>().toEqualTypeOf<never>();
        const { id, ...expected } = person;
        expect(authorizeAndProjectViewDto(db3.platformUserEditorView, person, platform, "platform person")).toEqual(expected);
        expect(db3.platformUserEditorView.parseDto({ ...person, hashedPassword: "secret", globalRoleId: 5, bandUsersByUser: [] })).toEqual(expected);
        expect(db3.platformUserEditorView.hydrate(expected, new db3.DB3ReferenceStore())).toEqual(expected);
    });

    it("keeps existing band readers and owner projections under their separate policy", () => {
        expect(authorizeAndProjectViewDto(db3.userEditorView, person, platform, "platform through person view")).toBeNull();
        const dto = authorizeAndProjectViewDto(db3.userEditorView, person, bandManager, "band person");
        expect(dto).toMatchObject({ name: person.name, email: person.email });
        expect(dto).toHaveProperty("isSysAdmin", false);
        expect(db3.xUser.fields).not.toHaveProperty("instruments");
        expect(db3.xUser.fields).not.toHaveProperty("tags");
    });

    it("permits basic person writes and preserves the stricter email update permission", () => {
        for (const columnName of ["name", "phone", "cssClass"]) {
            expect(db3.xPlatformUser.authorizeColumnForEdit({ model: person, columnName, fallbackOwnerId: null, auth: platform })).toBe(true);
        }
        expect(db3.xPlatformUser.authorizeColumnForEdit({ model: person, columnName: "email", fallbackOwnerId: null, auth: platform })).toBe(false);
        expect(db3.xPlatformUser.authorizeColumnForEdit({ model: person, columnName: "email", fallbackOwnerId: null, auth: authorize(1, Permission.manage_global_users, Permission.sysadmin) })).toBe(true);
        expect(db3.platformUserEditorView.crud.operations.update.command.parseDto({ identity: person.publicId, patch: { name: "Edited", phone: null } }))
            .toEqual({ identity: person.publicId, patch: { name: "Edited", phone: null } });
    });

    it.each(["createdAt", "isDeleted", "isSysAdmin"])("keeps %s read-only even for a platform administrator", columnName => {
        const auth = authorize(1, Permission.manage_global_users, Permission.sysadmin);
        expect(db3.xPlatformUser.authorizeColumnForEdit({ model: person, columnName, fallbackOwnerId: null, auth })).toBe(false);
        expect(db3.xPlatformUser.authorizeColumnForInsert({ model: person, columnName, auth })).toBe(false);
        const newPerson = {};
        db3.xPlatformUser.columns.find(field => field.member === columnName)!.ApplyToNewRow(newPerson);
        expect(newPerson).toEqual({});
    });

    it.each(["globalRoleId", "bandId", "instruments", "tags", "signInMethods", "hashedPassword", "id", "publicId"])("rejects caller-owned %s in both generated write envelopes", field => {
        expect(() => db3.platformUserEditorView.crud.operations.create.command.parseDto({ name: "Person", email: person.email, [field]: "crafted" })).toThrow();
        expect(() => db3.platformUserEditorView.crud.operations.update.command.parseDto({ identity: person.publicId, patch: { [field]: "crafted" } })).toThrow();
    });

    it("does not generate account deletion or change the shared-person command registration", () => {
        expect(db3.getDB3CrudViewForCommand("PlatformUser_Delete")).toBeUndefined();
        expect(db3.getDB3CrudViewForCommand("User_Update")).toBe(db3.userEditorView);
        expect(db3.getDB3CrudViewForCommand("PlatformUser_Update")).toBe(db3.platformUserEditorView);
    });
});
