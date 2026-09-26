import { describe, expect, expectTypeOf, it } from "vitest";
import { Permission } from "shared/permissions";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { createDB3Authorization } from "src/core/db3/shared/db3Authorization";
import type { DB3ServerAuthorization } from "src/core/db3/server/db3ServerAuthorization";

describe("PermissionSet", () => {
    it("accepts names without a database catalog and rejects malformed grants", () => {
        expect(new PermissionSet([]).names).toEqual([]);
        // @ts-expect-error Omitted grants are a programming error.
        expect(() => new PermissionSet()).toThrow("permission names");
        // @ts-expect-error Client capability checks accept names, not database records.
        expect(() => new PermissionSet([{ id: 10, name: "view" }])).toThrow("permission names");
        const permissions = new PermissionSet(["view", "edit", "view"]);
        expect(permissions.names).toEqual(["view", "edit"]);
        expect(permissions.includesName("edit")).toBe(true);
        expect(permissions.includesName("10")).toBe(false);
        expect(permissions).not.toHaveProperty("ids");
        expect(permissions).not.toHaveProperty("includesId");
        const clientAuthorization = createDB3Authorization(null, permissions);
        expectTypeOf(clientAuthorization).not.toMatchTypeOf<DB3ServerAuthorization>();
    });

    it("detects revoked grants as well as added grants without depending on order", () => {
        const permissions = new PermissionSet(["view", "edit"]);
        expect(permissions.hasSameNames(["edit", "view", "view"])).toBe(true);
        expect(permissions.hasSameNames(["view"])).toBe(false);
        expect(permissions.hasSameNames(["edit", "view", "extra"])).toBe(false);
        expect(new PermissionSet(["view"]).hasSameNames(["view", "edit"])).toBe(false);
        expect(permissions.hasAll(new PermissionSet(["view"]))).toBe(true);
        expect(permissions.hasAll(new PermissionSet(["missing"]))).toBe(false);
    });

    it("derives delegability from the canonical registry", () => {
        const actor = new PermissionSet([Permission.view_users_basic_info, Permission.sysadmin]);
        expect(actor.hasAllDelegable(new PermissionSet([Permission.view_users_basic_info]))).toBe(true);
        expect(actor.hasAllDelegable(new PermissionSet([Permission.sysadmin]))).toBe(false);
        expect(actor.hasAllDelegable(new PermissionSet(["unknown_permission"]))).toBe(false);
    });
});

describe("ServerPermissionSet", () => {
    it("keeps database identities only in the server capability", () => {
        const permissions = new ServerPermissionSet([
            { id: 10, name: Permission.login }, { id: 20, name: Permission.public },
            { id: 10, name: Permission.login },
        ]);
        expect(permissions.ids).toEqual([10, 20]);
        expect(permissions.includesId(20)).toBe(true);
        expect(permissions.includesId(30)).toBe(false);
        expect(permissions.names).toEqual([Permission.login, Permission.public]);
        expect(permissions.hasAll(new PermissionSet([Permission.login]))).toBe(true);
        expectTypeOf(createDB3Authorization(null, permissions)).toEqualTypeOf<DB3ServerAuthorization>();
    });

    it("requires real database identities, not optional or placeholder IDs", () => {
        // @ts-expect-error Server visibility checks require a database identity.
        expect(() => new ServerPermissionSet([{ name: Permission.login }])).toThrow("IDs and names");
        expect(() => new ServerPermissionSet([{ id: -1, name: Permission.login }])).toThrow("IDs and names");
        expect(() => new ServerPermissionSet([{ id: 0, name: Permission.login }])).toThrow("IDs and names");
    });
});
