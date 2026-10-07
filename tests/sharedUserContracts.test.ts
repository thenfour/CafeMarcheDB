import { describe, expect, expectTypeOf, it } from "vitest";
import { SignInMethodType } from "db";
import { Permission } from "shared/permissions";
import { parsePublicId, type UserPublicId } from "shared/publicId";
import * as db3 from "src/core/db3/db3";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { authorizeAndProjectViewDto } from "src/core/db3/server/db3QueryCore";
import { prepareDB3ReadSelection } from "src/core/db3/shared/core/db3ReadSelection";
import { testServerAuthorization } from "./support/serverAuthorization";

const userId = parsePublicId<"User">("SharedAccount001");
const person = {
    id: 10, publicId: userId, name: "Alice", email: "alice@example.test", phone: "+32 123",
    isSysAdmin: false, isDeleted: false, cssClass: null, createdAt: new Date("2026-10-01T12:00:00Z"),
};

function authorization(actorId: number, ...permissions: Permission[]) {
    return testServerAuthorization({ id: actorId }, new ServerPermissionSet(
        permissions.map((name, index) => ({ id: index + 1, name })),
    ));
}

const owner = authorization(person.id, Permission.login);
const reader = authorization(20, Permission.login, Permission.view_users_basic_info);
const platformAdmin = authorization(1, Permission.login, Permission.view_users_basic_info, Permission.sysadmin);
const membershipFields = ["instruments", "tags", "bandUserInstruments", "bandUserTagAssignments", "bandRoleId", "bandId"];
const secrets = ["hashedPassword", "calendarFeedToken", "accessToken", "uid", "signInMethods", "globalRole", "globalRoleId"];

describe("shared person and membership contract boundary", () => {
    it("keeps shared selectors and client types free of band assignments, grants and credentials", () => {
        type ForeignAccountField = "instruments" | "tags" | "bandUserInstruments" | "bandUserTagAssignments"
            | "bandRoleId" | "bandId" | "globalRoleId" | "hashedPassword" | "calendarFeedToken" | "uid" | "signInMethods";
        expectTypeOf<Extract<keyof db3.UserPayload, ForeignAccountField>>().toEqualTypeOf<never>();
        expectTypeOf<Extract<keyof db3.UserClientPayload, ForeignAccountField | "id">>().toEqualTypeOf<never>();
        expectTypeOf<db3.UserClientPayload["publicId"]>().toEqualTypeOf<UserPublicId>();
        for (const args of [db3.UserArgs, db3.UserSafeArgs, db3.UserMinimumArgs]) {
            for (const field of [...membershipFields, ...secrets]) {
                expect(args.select).not.toHaveProperty(field);
            }
        }
    });

    it("prepares shared reads without fetching obsolete person associations", () => {
        const context = { auth: owner, filter: { items: [] } };
        const selection = db3.userEditorView.getSelectionArgs(context);
        for (const args of [db3.UserSafeArgs, selection]) {
            const plan = prepareDB3ReadSelection(db3.xUser, args);
            expect(plan.selection.select).toMatchObject({ publicId: true, name: true, phone: true });
            for (const field of [...membershipFields, ...secrets]) {
                expect(plan.selection.select).not.toHaveProperty(field);
            }
        }
    });

    it("derives the account editor DTO from shared scalar fields and strips unselected data", () => {
        type Dto = db3.DtoOf<typeof db3.userEditorView>;
        expectTypeOf<Extract<keyof Dto, "instruments" | "tags" | "id" | "signInMethods">>().toEqualTypeOf<never>();
        const dto = db3.userEditorView.parseDto({ ...person, instruments: [], tags: [], hashedPassword: "secret" });
        const { id, ...expected } = person;
        expect(dto).toEqual(expected);
        expect(db3.userEditorView.hydrate(dto, new db3.DB3ReferenceStore())).toEqual(expected);
    });

    it.each(membershipFields)("rejects %s on both generated shared-account write commands", field => {
        expect(db3.xUser.fields).not.toHaveProperty(field);
        expect(() => db3.userEditorView.crud.operations.create.command.parseDto({ name: "Alice", [field]: [] })).toThrow();
        expect(() => db3.userEditorView.crud.operations.update.command.parseDto({
            identity: userId, patch: { name: "Alice", [field]: [] },
        })).toThrow();
    });

    it("retains scalar profile updates and validates their field constraints", () => {
        const edit = { identity: userId, patch: { name: "Alice", phone: "+32 123" } };
        expect(db3.userEditorView.crud.operations.update.command.parseDto(edit)).toEqual(edit);
        for (const field of ["name", "phone"]) {
            expect(() => db3.userEditorView.crud.operations.update.command.parseDto({
                ...edit, patch: { [field]: "x".repeat(769) },
            })).toThrow();
        }
        expect(db3.getDB3CrudViewForCommand("User_Delete")).toBeUndefined();
    });

    it("retains owner contact access while withholding operational account metadata", () => {
        const dto = authorizeAndProjectViewDto(db3.userEditorView, person, owner, "shared-owner");
        expect(dto).toMatchObject({ publicId: userId, name: "Alice", email: person.email, phone: person.phone });
        expect(dto).not.toHaveProperty("id");
        expect(dto).not.toHaveProperty("createdAt");
        expect(dto).not.toHaveProperty("isSysAdmin");
    });

    it("requires the contact-read permission for another person's contact details", () => {
        const dto = authorizeAndProjectViewDto(db3.userEditorView, person, reader, "shared-reader");
        expect(dto).toMatchObject({ publicId: userId, name: "Alice" });
        expect(dto).not.toHaveProperty("email");
        expect(dto).not.toHaveProperty("phone");
        const contactReader = authorization(20, Permission.login, Permission.view_users_basic_info, Permission.view_user_contact_info);
        expect(authorizeAndProjectViewDto(db3.userEditorView, person, contactReader, "shared-contact-reader"))
            .toMatchObject({ email: person.email, phone: person.phone });
    });

    it("keeps sign-in summaries in their separate administrator-only projection", () => {
        const model = { ...person, signInMethods: [{ type: SignInMethodType.email, displayId: person.email }] };
        const summary = authorizeAndProjectViewDto(db3.userIdentitySummaryView, model, platformAdmin, "shared-sign-in-admin");
        expect(summary).toEqual({ publicId: userId, signInMethods: model.signInMethods });
        expect(authorizeAndProjectViewDto(db3.userIdentitySummaryView, model, owner, "shared-sign-in-owner"))
            .toEqual({ publicId: userId });
    });

    it("keeps the band-scoped assignment views and aggregate commands active", () => {
        expect(db3.bandUserInstrumentsView.entity).toBe(db3.xBandUser);
        expect(db3.bandUserTagsView.entity).toBe(db3.xBandUser);
        expect(db3.bandUserInstrumentsCommand.entity).toBe(db3.xBandUser);
        expect(db3.bandUserTagsCommand.entity).toBe(db3.xBandUser);
        expect(db3.xBandUser.bandScope).toMatchObject({ member: "bandId" });
    });

    it("keeps invitation assignment writes on the membership aggregate command", () => {
        expect(db3.xBandUserTagAssignment.deletePolicy).toBe("disabled");
        const manager = authorization(20, Permission.login, Permission.manage_users, Permission.sysadmin);
        for (const auth of [owner, manager, platformAdmin]) {
            expect(db3.xBandUserTagAssignment.authorizeRowBeforeInsert({ auth })).toBe(false);
            expect(db3.xBandUserTagAssignment.authorizeRowForEdit({ model: { publicId: "UserTagAssign001", bandUser: { userId: auth.userId } }, auth }))
                .toBe(false);
        }
    });
});
