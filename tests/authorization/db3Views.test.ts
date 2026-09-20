import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { authorizeAndProjectDB3ViewModel } from "@db3/server/db3PublicIds";
import { queryTable } from "@db3/server/db3QueryCore";
import { validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

const groupPublicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");
const group = {
    publicId: groupPublicId,
    name: "Brass",
    description: "Brass instruments",
    color: "orange",
    sortOrder: 1,
};
const tag = {
    id: 12,
    text: "Horn",
    description: "Horn-like instruments",
    color: null,
    sortOrder: 2,
    significance: null,
};

describe("DB3 named views", () => {
    it("validates view ownership as part of the query contract", () => {
        const request = validateDB3QueryRequest({
            table: {
                tableID: "InstrumentFunctionalGroup",
                tableName: "InstrumentFunctionalGroup",
                viewID: db3.instrumentFunctionalGroupListView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "db3-view-test",
        });
        expect(request.table.viewID).toBe(db3.instrumentFunctionalGroupListView.viewID);

        expect(() => validateDB3QueryRequest({
            table: {
                tableID: "Instrument",
                tableName: "Instrument",
                viewID: db3.instrumentFunctionalGroupListView.viewID,
            },
            filter: { items: [] },
            cmdbQueryContext: "db3-view-test",
        })).toThrow("does not belong to table 'Instrument'");

        expect(() => validateDB3QueryRequest({
            table: {
                tableID: "Instrument",
                tableName: "Instrument",
                viewID: "Missing_View",
            },
            filter: { items: [] },
            cmdbQueryContext: "db3-view-test",
        })).toThrow("unknown view ID 'Missing_View'");
    });

    it("parses the authorized DTO shape and never exposes a database ID", async () => {
        const findMany = vi.fn(async () => [{ id: 54, ...group }]);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.sysadmin },
        ]);

        const result = await queryTable({
            table: {
                tableID: "InstrumentFunctionalGroup",
                tableName: "InstrumentFunctionalGroup",
                viewID: db3.instrumentFunctionalGroupListView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "db3-view-test",
        }, {
            user: { id: 100 } as any,
            effectivePermissions,
        }, {
            InstrumentFunctionalGroup: { findMany },
        } as any);

        expect(result.items).toEqual([group]);
        expect(result.items[0]).not.toHaveProperty("id");
        expect(findMany).toHaveBeenCalledOnce();

        const restrictedDto = db3.instrumentFunctionalGroupListView.parseDto({
            id: 54,
            publicId: groupPublicId,
        });
        expect(restrictedDto).toEqual({ publicId: groupPublicId });
        expectTypeOf(restrictedDto.name).toEqualTypeOf<string | undefined>();
    });

    it("represents authorization-stripped fields as absent optional DTO members", () => {
        const publicData = db3.createDB3Authorization(null, new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
        ]));
        const authorized = authorizeAndProjectDB3ViewModel(db3.xEvent, {
            id: 8,
            name: "Public concert",
            startsAt: null,
            type: null,
            createdByUserId: 100,
            visiblePermissionId: 2,
            isDeleted: false,
        }, publicData, "db3-view-field-authorization");

        expect(authorized).toMatchObject({ id: 8, name: "Public concert" });
        expect(authorized).not.toHaveProperty("isDeleted");
    });

    it("hydrates a finite view graph from an explicit reference provider", () => {
        const references = new db3.DB3ReferenceStore();
        references.register(db3.instrumentFunctionalGroupEntity, [group]);
        references.register(db3.instrumentTagEntity, [tag]);

        const dto = db3.instrumentDashboardView.parseDto({
            id: 7,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            instrumentTags: [{ id: 70, instrumentId: 7, tagId: tag.id }],
        });
        const hydrated = db3.hydrateView(db3.instrumentDashboardView, dto, references);

        expect(hydrated.functionalGroup).toBe(group);
        expect(hydrated.instrumentTags[0]!.tag).toBe(tag);
        expectTypeOf(hydrated).toEqualTypeOf<db3.InstrumentDashboardClient>();
        expectTypeOf<db3.DbPayloadOf<typeof db3.instrumentDashboardView>>()
            .toMatchTypeOf<{
                id: number;
                functionalGroup: { id: number; publicId: string };
                instrumentTags: { id: number; instrumentId: number; tagId: number }[];
            }>();
    });

    it("reports the exact missing reference path", () => {
        const references = new db3.DB3ReferenceStore();
        references.register(db3.instrumentFunctionalGroupEntity, [group]);
        const dto = db3.instrumentDashboardView.parseDto({
            id: 7,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            instrumentTags: [{ id: 70, instrumentId: 7, tagId: tag.id }],
        });

        expect(() => db3.hydrateView(db3.instrumentDashboardView, dto, references))
            .toThrow("Instrument(7).instrumentTags[0].tagId");
    });
});
