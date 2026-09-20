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

    it("preserves a server-computed page order before a view removes database IDs", async () => {
        const secondPublicId = parsePublicId<"InstrumentFunctionalGroup">("BcDeFgHiJkLmNo12");
        const findMany = vi.fn(async () => [
            { id: 1, ...group },
            { id: 2, ...group, publicId: secondPublicId, name: "Woodwind" },
        ]);
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
            cmdbQueryContext: "db3-view-ordered-test",
        }, {
            user: { id: 100 } as any,
            effectivePermissions,
        }, {
            InstrumentFunctionalGroup: { findMany },
        } as any, {
            orderedPrimaryKeys: [2, 1],
        });

        expect(result.items.map(item => item.publicId)).toEqual([secondPublicId, groupPublicId]);
        expect(result.items.every(item => !("id" in item))).toBe(true);
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

    it("hydrates the Song search view recursively and keeps authorized fields optional", () => {
        const references = new db3.DB3ReferenceStore();
        const permission = {
            id: 4,
            name: "members",
            description: "",
            isVisibility: true,
            sortOrder: 1,
            significance: null,
            color: null,
            iconName: null,
        };
        const songTag = { id: 20, text: "March", description: "", color: null, sortOrder: 1, significance: null, group: null, indicator: null, indicatorCssClass: null };
        const fileTag = { id: 30, text: "Partition", description: "", color: null, sortOrder: 1, significance: db3.FileTagSignificance.Partition };
        references.register(db3.permissionEntity, [permission]);
        references.register(db3.songTagEntity, [songTag]);
        references.register(db3.fileTagEntity, [fileTag]);

        const dto = db3.songSearchView.parseDto({
            id: 7,
            name: "A song",
            visiblePermissionId: permission.id,
            tags: [{ id: 70, songId: 7, tagId: songTag.id }],
            taggedFiles: [{
                id: 80,
                fileId: 8,
                songId: 7,
                file: {
                    id: 8,
                    tags: [{ id: 90, fileTagId: fileTag.id }],
                },
            }],
        });
        const hydrated = db3.hydrateView(db3.songSearchView, dto, references);

        expect(hydrated.visiblePermission).toBe(permission);
        expect(hydrated.tags?.[0]?.tag).toBe(songTag);
        expect(hydrated.taggedFiles?.[0]?.file?.tags?.[0]?.fileTag).toBe(fileTag);
        expectTypeOf(dto.aliases).toEqualTypeOf<string | undefined>();
        expectTypeOf(hydrated).toEqualTypeOf<db3.SongSearchClient>();
    });

    it("projects the Song search DTO through nested field authorization", async () => {
        const findMany = vi.fn(async () => [{
            id: 7,
            name: "A song",
            aliases: "",
            startBPM: null,
            endBPM: null,
            introducedYear: null,
            lengthSeconds: null,
            createdByUserId: 100,
            visiblePermissionId: null,
            isDeleted: false,
            tags: [{ id: 70, songId: 7, tagId: 20 }],
            taggedFiles: [{
                id: 80,
                fileId: 8,
                songId: 7,
                file: {
                    id: 8,
                    uploadedByUserId: 100,
                    visiblePermissionId: null,
                    isDeleted: false,
                    tags: [{ id: 90, fileTagId: 30 }],
                },
            }],
            credits: [{
                id: 100,
                userId: 100,
                songId: 7,
                typeId: 2,
                year: "2026",
                comment: "",
                user: { id: 100, name: "Composer" },
            }],
        }]);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.visibility_members },
            { id: 4, name: Permission.view_songs },
            { id: 5, name: Permission.view_files },
        ]);

        const result = await queryTable({
            table: {
                tableID: db3.xSong.tableID,
                tableName: db3.xSong.tableName,
                viewID: db3.songSearchView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "song-search-view-test",
        }, {
            user: { id: 100 } as any,
            effectivePermissions,
        }, {
            Song: { findMany },
        } as any);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({
            id: 7,
            tags: [{ id: 70, tagId: 20 }],
            taggedFiles: [{
                id: 80,
                file: { id: 8, tags: [{ id: 90, fileTagId: 30 }] },
            }],
            credits: [{ id: 100, user: { id: 100, name: "Composer" } }],
        });
        expect(result.items[0]).not.toHaveProperty("createdByUserId");
        expect(result.items[0]?.taggedFiles?.[0]).not.toHaveProperty("fileId");
        expect(result.items[0]?.credits?.[0]).not.toHaveProperty("songId");
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
