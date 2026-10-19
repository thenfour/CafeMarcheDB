import { describe, expect, expectTypeOf, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId, type PermissionPublicId } from "shared/publicId";
import { ConstEnumStringField } from "src/core/db3/shared/columnTypes/enum";
import { DB3ReferenceStore, defineReferenceContract, reference } from "src/core/db3/shared/core/db3Hydration";
import { deriveViewContract } from "src/core/db3/shared/core/db3ViewContract";
import { xPermission } from "src/core/db3/shared/schema/user";
import { xSong } from "src/core/db3/shared/schema/song";
import { permissionDashboardView, dashboardPermissionResource } from "src/core/db3/shared/references/dashboardReferences";
import type { ClientOf, DtoOf } from "src/core/db3/shared/core/db3View";
import type { DB3ReadTransportValueOf } from "src/core/db3/shared/db3core";

const permissionId = parsePublicId<"Permission">("PermissionName01");
const songId = parsePublicId<"Song">("PermissionSong01");
const permissionContract = deriveViewContract(xPermission, { select: { publicId: true, name: true } });

describe("registry-typed permission columns", () => {
    it("validates names at the column boundary and preserves Permission throughout derived models", () => {
        expectTypeOf<DB3ReadTransportValueOf<typeof xPermission.fields.name>>().toEqualTypeOf<Permission>();
        expectTypeOf<DtoOf<typeof permissionDashboardView>["name"]>().toEqualTypeOf<Permission>();
        expectTypeOf<ClientOf<typeof permissionDashboardView>["name"]>().toEqualTypeOf<Permission>();
        expectTypeOf<ReturnType<typeof dashboardPermissionResource.hydrate>["name"]>().toEqualTypeOf<Permission>();

        for (const name of Object.values(Permission)) {
            const dto = permissionContract.dtoSchema.parse({ publicId: permissionId, name });
            expect(permissionContract.hydrate(dto, new DB3ReferenceStore()).name).toBe(name);
        }
        for (const name of ["retired_permission", "visibility_members ", null, undefined, 123, {}]) {
            expect(permissionContract.dtoSchema.safeParse({ publicId: permissionId, name }).success).toBe(false);
        }
    });

    it("carries the name type through nested relations without changing foreign identities", () => {
        const contract = deriveViewContract(xSong, { select: {
            publicId: true, visiblePermissionId: true,
            visiblePermission: { select: { publicId: true, name: true } },
        } });
        const dto = contract.dtoSchema.parse({ publicId: songId, visiblePermissionId: permissionId,
            visiblePermission: { publicId: permissionId, name: Permission.visibility_members } });
        const model = contract.hydrate(dto, new DB3ReferenceStore());
        expectTypeOf(model.visiblePermissionId).toEqualTypeOf<PermissionPublicId | null>();
        expectTypeOf<NonNullable<typeof model.visiblePermission>["name"]>().toEqualTypeOf<Permission>();
        expect(model.visiblePermission?.name).toBe(Permission.visibility_members);
        expect(contract.dtoSchema.safeParse({ ...dto, visiblePermission: { publicId: permissionId, name: "retired_permission" } }).success).toBe(false);
    });

    it("uses the same narrowed name when hydrating normalized visibility references", () => {
        const references = defineReferenceContract({
            permission: reference(xPermission)<ReturnType<typeof permissionContract.hydrate>>(),
        });
        const store = new DB3ReferenceStore(references);
        const permission = permissionContract.hydrate(permissionContract.dtoSchema.parse({ publicId: permissionId, name: Permission.visibility_members }), new DB3ReferenceStore());
        store.register(xPermission, [permission]);
        const contract = deriveViewContract(xSong, { select: { publicId: true, visiblePermissionId: true } }, { references });
        const dto = contract.dtoSchema.parse({ publicId: songId, visiblePermissionId: permissionId });
        const model = contract.hydrate(dto, store);
        expectTypeOf<NonNullable<typeof model.visiblePermission>["name"]>().toEqualTypeOf<Permission>();
        expect(model.visiblePermission).toBe(permission);
        expect(contract.hydrate({ ...dto, visiblePermissionId: null }, store).visiblePermission).toBeNull();
    });

    it("infers stored enum values, rejects invalid defaults and respects nullability", () => {
        const options = { label: "stored_value" } as const;
        const field = new ConstEnumStringField({ columnName: "value", options, defaultValue: null,
            allowNull: false, _customAuth: () => true });
        const nullable = new ConstEnumStringField({ columnName: "value", options, defaultValue: null,
            allowNull: true, _customAuth: () => true });
        expectTypeOf<DB3ReadTransportValueOf<typeof field>>().toEqualTypeOf<"stored_value">();
        expectTypeOf<DB3ReadTransportValueOf<typeof nullable>>().toEqualTypeOf<"stored_value" | null>();
        expect(field.parseAndHydrateReadTransportValue("stored_value")).toBe("stored_value");
        expect(() => field.parseReadTransportValue("label")).toThrow("unrecognized option");
        expect(() => field.parseReadTransportValue(null)).toThrow();
        expect(nullable.parseReadTransportValue(null)).toBeNull();
        if (false) {
            // @ts-expect-error A default cannot introduce an option absent from the vocabulary.
            new ConstEnumStringField({ columnName: "value", options, defaultValue: "other", allowNull: false, _customAuth: () => true });
        }
    });
});
