import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { authorizeAndProjectDB3ViewModel } from "@db3/server/db3PublicIds";
import {
    authorizeAndHydrateViewModel,
    queryTable,
    queryView,
} from "@db3/server/db3QueryCore";
import { validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { DateTimeRange } from "shared/time";
import { Prisma } from "db";
import { z } from "zod";
import { gGeneralPaletteList } from "src/core/components/color/palette";

const groupPublicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");
const tagPublicId = parsePublicId<"InstrumentTag">("AbCdEfGhIjKlMn02");
const tagAssociationPublicId = parsePublicId<"InstrumentTagAssociation">("AbCdEfGhIjKlMn03");
const songTagPublicId = parsePublicId<"SongTag">("AbCdEfGhIjKlMn04");
const songTagAssociationPublicId = parsePublicId<"SongTagAssociation">("AbCdEfGhIjKlMn05");
const instrumentPublicId = parsePublicId<"Instrument">("AbCdEfGhIjKlMn06");
const fileTagPublicId = parsePublicId<"FileTag">("AbCdEfGhIjKlMn07");
const fileTagAssignmentPublicId = parsePublicId<"FileTagAssignment">("AbCdEfGhIjKlMn08");
const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("AbCdEfGhIjKlMn09");
const wikiPageTagAssignmentPublicId = parsePublicId<"WikiPageTagAssignment">("AbCdEfGhIjKlMn10");
const eventTypePublicId = parsePublicId<"EventType">("AbCdEfGhIjKlMn11");
const eventStatusPublicId = parsePublicId<"EventStatus">("AbCdEfGhIjKlMn12");
const eventTagPublicId = parsePublicId<"EventTag">("AbCdEfGhIjKlMn13");
const eventTagAssignmentPublicId = parsePublicId<"EventTagAssignment">("AbCdEfGhIjKlMn14");
const userTagPublicId = parsePublicId<"UserTag">("AbCdEfGhIjKlMn15");
const songCreditTypePublicId = parsePublicId<"SongCreditType">("AbCdEfGhIjKlMn16");
const songCreditPublicId = parsePublicId<"SongCredit">("AbCdEfGhIjKlMn17");
const permissionPublicId = parsePublicId<"Permission">("AbCdEfGhIjKlMn18");
const fileUserTagPublicId = parsePublicId<"FileUserTag">("AbCdEfGhIjKlMn18");
const fileSongTagPublicId = parsePublicId<"FileSongTag">("AbCdEfGhIjKlMn19");
const fileEventTagPublicId = parsePublicId<"FileEventTag">("AbCdEfGhIjKlMn20");
const fileInstrumentTagPublicId = parsePublicId<"FileInstrumentTag">("AbCdEfGhIjKlMn21");
const fileWikiPageTagPublicId = parsePublicId<"FileWikiPageTag">("AbCdEfGhIjKlMn22");
const group = {
    publicId: groupPublicId,
    name: "Brass",
    description: "Brass instruments",
    color: "orange",
    sortOrder: 1,
};
const hydratedGroup = {
    ...group,
    color: gGeneralPaletteList.findEntry("orange"),
};
const tag = {
    id: 12,
    publicId: tagPublicId,
    text: "Horn",
    description: "Horn-like instruments",
    color: null,
    sortOrder: 2,
    significance: null,
};

describe("DB3 named views", () => {
    it("queries a dashboard view through authorization, DTO parsing, and hydration", async () => {
        const row = {
            id: 7,
            text: "Going",
            description: "Attending",
            iconName: null,
            color: "green",
            sortOrder: 1,
            isDeleted: false,
            strength: 100,
            personalText: "I am going",
            pastText: "Attended",
            pastPersonalText: "I attended",
            isActive: true,
        };
        const findMany = vi.fn(async () => [row]);
        // queryView accepts the full Prisma client contract; this focused test double
        // deliberately implements only the delegate exercised by this view.
        const database = { EventAttendance: { findMany } } as unknown as Parameters<typeof queryView>[3];
        const references = db3.createDashboardReferenceStore();
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
            { id: 3, name: Permission.view_events_nonpublic },
        ]);

        const result = await queryView({
            view: db3.eventAttendanceDashboardView,
            filter: { items: [] },
            cmdbQueryContext: "dashboard-view-query-test",
            orderBy: undefined,
        }, {
            user: null,
            effectivePermissions,
        }, references, database);

        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            select: expect.objectContaining({
                id: true,
                text: true,
                color: true,
                personalText: true,
            }),
        }));
        expect(result.items).toEqual([{
            ...row,
            color: gGeneralPaletteList.findEntry("green"),
        }]);
        expectTypeOf(result.items).toEqualTypeOf<db3.EventAttendanceDashboardClient[]>();
    });

    it("removes unauthorized dashboard-view fields before hydration", async () => {
        const findMany = vi.fn(async () => [{
            id: 7,
            text: "Going",
            description: "Attending",
            iconName: null,
            color: "green",
            sortOrder: 1,
            isDeleted: false,
            strength: 100,
            personalText: "I am going",
            pastText: "Attended",
            pastPersonalText: "I attended",
            isActive: true,
        }]);
        // queryView accepts the full Prisma client contract; this focused test double
        // deliberately implements only the delegate exercised by this view.
        const database = { EventAttendance: { findMany } } as unknown as Parameters<typeof queryView>[3];

        const result = await queryView({
            view: db3.eventAttendanceDashboardView,
            filter: { items: [] },
            cmdbQueryContext: "dashboard-view-authorization-test",
            orderBy: undefined,
        }, {
            user: null,
            effectivePermissions: new PermissionSet([
                { id: 1, name: Permission.always_grant },
                { id: 2, name: Permission.public },
            ]),
        }, db3.createDashboardReferenceStore(), database);

        expect(result.items).toEqual([{ id: 7 }]);
        expect(db3.isCompleteEventAttendanceDashboardClient(result.items[0]!)).toBe(false);
    });

    it("derives ordinary selections from DTO schemas and preserves explicit query additions", async () => {
        const context = {
            filter: { items: [] },
            authorization: db3.createDB3Authorization(null, new PermissionSet([])),
        };

        expect(db3.eventTypeEditorView.getSelectionArgs(context)).toEqual({
            select: {
                publicId: true,
                text: true,
                description: true,
                color: true,
                sortOrder: true,
                significance: true,
                iconName: true,
                isDeleted: true,
            },
        });
        expect(db3.frontpageGalleryItemEditorView.getSelectionArgs(context))
            .toMatchObject({
                select: {
                    file: {
                        select: {
                            id: true,
                            fileLeafName: true,
                            storedLeafName: true,
                            externalURI: true,
                            sizeBytes: true,
                            mimeType: true,
                            customData: true,
                        },
                    },
                    createdByUser: { select: { id: true, name: true } },
                    visiblePermission: {
                        select: {
                            publicId: true,
                        },
                    },
                },
            });
        expect(db3.roleEditorView.getSelectionArgs(context).select.permissions.orderBy)
            .toEqual([
                { permission: { sortOrder: "asc" } },
                { permission: { name: "asc" } },
                { permission: { id: "asc" } },
            ]);
        expect(db3.wikiPageEditorView.getSelectionArgs(context).select.tags.orderBy)
            .toEqual([
                { tag: { sortOrder: "asc" } },
                { tag: { text: "asc" } },
            ]);
        expect(db3.eventTypeEditorView.getWhereClause(context)).toBeUndefined();
        expect(db3.songCreditUserView.getWhereClause(context)).toBeUndefined();
        expect(db3.permissionVisibilityView.getWhereClause(context)).toEqual({
            isVisibility: { equals: true },
            id: { in: [] },
        });

        const permissionDto = db3.permissionVisibilityView.parseDto({
            publicId: permissionPublicId,
            name: Permission.visibility_public,
            description: "Public",
            sortOrder: 1,
            isVisibility: true,
            significance: null,
            color: "green",
            iconName: null,
        });
        expectTypeOf(permissionDto.name).toEqualTypeOf<string>();
        expectTypeOf(permissionDto.description).toEqualTypeOf<string | null>();
        expectTypeOf(permissionDto.isVisibility).toEqualTypeOf<boolean>();

        expectTypeOf<db3.DbPayloadOf<typeof db3.eventTypeEditorView>>()
            .toMatchTypeOf<{ publicId: string; text: string }>();
    });

    it("composes a root view predicate without disturbing nested Prisma where clauses", async () => {
        const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
            select: {
                id: true,
                tags: {
                    select: { id: true },
                    where: { eventTagId: { gt: 0 } },
                },
            },
        });
        const view = db3.defineView({
            viewID: "Test_EventNestedWhere",
            entity: db3.xEvent,
            selection,
            where: ({ authorization }) => ({
                createdByUserId: authorization.userId,
            }),
            dtoSchema: z.object({
                id: z.number().int(),
                tags: z.array(z.object({ id: z.number().int() })).optional(),
            }),
            hydrate: dto => dto,
        });
        const findMany = vi.fn(async (_args: unknown) => []);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
            { id: 3, name: Permission.view_events },
            { id: 4, name: Permission.visibility_public },
        ]);

        await queryTable({
            table: {
                tableID: "Event",
                tableName: "Event",
                viewID: view.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "db3-view-where-composition-test",
        }, {
            user: { id: 42 } as any,
            effectivePermissions,
        }, {
            Event: { findMany },
        } as any);

        const prismaArgs = findMany.mock.calls[0]![0] as any;
        expect(prismaArgs.where.AND).toEqual(expect.arrayContaining([
            { createdByUserId: 42 },
        ]));
        expect(prismaArgs.select.tags.where.AND).toEqual(expect.arrayContaining([
            { eventTagId: { gt: 0 } },
        ]));
        expectTypeOf(view.getWhereClause({
            filter: { items: [] },
            authorization: db3.createDB3Authorization({ id: 42 }, effectivePermissions),
        })).toEqualTypeOf<Prisma.EventWhereInput | undefined>();
    });

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

        expect(() => db3.instrumentFunctionalGroupListView.parseDto({
            publicId: groupPublicId,
        })).toThrow();
        expectTypeOf<db3.DtoOf<typeof db3.instrumentFunctionalGroupListView>["name"]>()
            .toEqualTypeOf<string>();
    });

    it("applies the same view boundary to a single row returned by a mutation", () => {
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.sysadmin },
        ]);
        const result = authorizeAndHydrateViewModel(
            db3.instrumentFunctionalGroupListView,
            { id: 54, ...group },
            db3.createDB3Authorization({ id: 100 }, effectivePermissions),
            db3.createDashboardReferenceStore(),
            "db3-single-view-model-test",
        );

        expect(result).toEqual(hydratedGroup);
        expect(result).not.toHaveProperty("id");
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

    it("returns the normalized Instrument editor DTO for reference-store hydration", async () => {
        const findMany = vi.fn(async () => [{
            id: 7,
            publicId: instrumentPublicId,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: 54,
            functionalGroup: { publicId: groupPublicId },
            instrumentTags: [{
                id: 70,
                publicId: tagAssociationPublicId,
                tagId: tag.id,
                tag: { publicId: tagPublicId },
            }],
        }]);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
        ]);

        const result = await queryTable({
            table: {
                tableID: "Instrument",
                tableName: "Instrument",
                viewID: db3.instrumentEditorView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "instrument-editor-view-test",
        }, {
            user: { id: 100 } as any,
            effectivePermissions,
        }, {
            Instrument: { findMany },
        } as any);

        expect(result.items).toEqual([{
            publicId: instrumentPublicId,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            instrumentTags: [{ publicId: tagAssociationPublicId, tagId: tagPublicId }],
        }]);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            select: expect.objectContaining({
                functionalGroupId: true,
                functionalGroup: { select: { publicId: true } },
                instrumentTags: expect.objectContaining({
                    select: {
                        publicId: true,
                        tagId: true,
                        tag: { select: { publicId: true } },
                    },
                }),
            }),
        }));
    });

    it("queries the finite Custom Link and Menu Link collection views", async () => {
        const createdAt = new Date("2026-09-21T12:00:00.000Z");
        const createdByUser = { id: 100, name: "Ada", cssClass: null };
        const customLink = {
            id: 20,
            name: "Scores",
            description: "Shared scores",
            slug: "scores",
            destinationURL: "https://example.test/scores",
            redirectType: "Temporary",
            intermediateMessage: null,
            forwardQuery: true,
            createdAt,
            createdByUserId: createdByUser.id,
            createdByUser,
            _count: { visits: 42 },
        };
        const menuLink = {
            id: 30,
            sortOrder: 2,
            realm: "General",
            applicationPage: null,
            groupName: "Resources",
            caption: "Scores",
            iconName: "Link",
            linkType: "ExternalURL",
            externalURI: "https://example.test/scores",
            wikiSlug: null,
            visiblePermissionId: null,
            groupCssClass: "resources",
            itemCssClass: "scores",
            createdAt,
            createdByUserId: createdByUser.id,
            createdByUser,
        };
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.sysadmin },
            { id: 4, name: Permission.view_custom_links },
            { id: 5, name: Permission.public },
        ]);
        const authorization = {
            user: { id: createdByUser.id } as any,
            effectivePermissions,
        };

        const customResult = await queryTable({
            table: {
                tableID: db3.xCustomLink.tableID,
                tableName: db3.xCustomLink.tableName,
                viewID: db3.customLinkListView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "custom-link-list-view-test",
        }, authorization, {
            CustomLink: { findMany: vi.fn(async () => [customLink]) },
        } as any);
        const menuResult = await queryTable({
            table: {
                tableID: db3.xMenuLink.tableID,
                tableName: db3.xMenuLink.tableName,
                viewID: db3.menuLinkListView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "menu-link-list-view-test",
        }, authorization, {
            MenuLink: { findMany: vi.fn(async () => [menuLink]) },
        } as any);

        expect(customResult.items).toEqual([customLink]);
        expect(menuResult.items).toEqual([menuLink]);
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

    it("projects the finite WikiPage tag editor view", async () => {
        const findMany = vi.fn(async () => [{
            id: 15,
            slug: "policy",
            createdByUserId: 100,
            visiblePermissionId: null,
            tags: [{
                id: 16,
                publicId: wikiPageTagAssignmentPublicId,
                tagId: 17,
                tag: {
                    id: 17,
                    publicId: wikiPageTagPublicId,
                    text: "Policy",
                    description: "Policy page",
                    color: null,
                    sortOrder: 1,
                    significance: "Policy",
                },
            }],
        }]);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.view_wiki_pages },
        ]);

        const result = await queryTable({
            table: {
                tableID: db3.xWikiPage.tableID,
                tableName: db3.xWikiPage.tableName,
                viewID: db3.wikiPageEditorView.viewID,
            },
            orderBy: undefined,
            filter: { pks: [15] },
            cmdbQueryContext: "wiki-page-editor-view-test",
        }, {
            user: { id: 100 } as any,
            effectivePermissions,
        }, {
            WikiPage: { findMany },
        } as any);

        expect(result.items).toEqual([{
            id: 15,
            tags: [{
                publicId: wikiPageTagAssignmentPublicId,
                tagId: wikiPageTagPublicId,
            }],
        }]);
        expect(result.items[0]!.tags[0]).not.toHaveProperty("id");
        expect(result.items[0]!.tags[0]).not.toHaveProperty("wikiPageId");
        expect(result.items[0]).not.toHaveProperty("slug");
        expect(findMany).toHaveBeenCalledOnce();
    });

    it("hydrates a finite view graph from an explicit reference provider", () => {
        const references = db3.createDashboardReferenceStore();
        db3.registerDashboardReferences(references, {
            instrumentFunctionalGroup: [hydratedGroup],
            instrumentTag: [tag],
        });

        const dto = db3.instrumentDashboardView.parseDto({
            publicId: instrumentPublicId,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            instrumentTags: [{
                publicId: tagAssociationPublicId,
                tagId: tagPublicId,
            }],
        });
        const hydrated = db3.hydrateView(db3.instrumentDashboardView, dto, references);

        expect(hydrated.functionalGroup).toEqual(
            references.require(db3.xInstrumentFunctionalGroup, group.publicId, "test"),
        );
        expect(hydrated.instrumentTags[0]!.tag).toEqual(
            references.require(db3.xInstrumentTag, tag.publicId, "test"),
        );
        expectTypeOf(hydrated).toEqualTypeOf<db3.InstrumentDashboardClient>();
        expectTypeOf<db3.DbPayloadOf<typeof db3.instrumentDashboardView>>()
            .toMatchTypeOf<{
                publicId: string;
                functionalGroupId: number;
                functionalGroup: { publicId: string };
                instrumentTags: {
                    publicId: string;
                    tagId: number;
                    tag: { publicId: string };
                }[];
            }>();
    });

    it("hydrates the Song search view recursively and keeps authorized fields optional", () => {
        const references = db3.createDashboardReferenceStore();
        const permission = {
            id: 4,
            publicId: permissionPublicId,
            name: "members",
            description: "",
            isVisibility: true,
            sortOrder: 1,
            significance: null,
            color: null,
            iconName: null,
        };
        const songTag = { publicId: songTagPublicId, text: "March", description: "", color: null, sortOrder: 1, significance: null, group: null, indicator: null, indicatorCssClass: null };
        const fileTag = { publicId: fileTagPublicId, text: "Partition", description: "", color: null, sortOrder: 1, significance: db3.FileTagSignificance.Partition };
        db3.registerDashboardReferences(references, {
            permission: [permission],
            songTag: [songTag],
            fileTag: [fileTag],
        });

        const dto = db3.songSearchView.parseDto({
            id: 7,
            name: "A song",
            aliases: "",
            startBPM: null,
            endBPM: null,
            introducedYear: null,
            lengthSeconds: null,
            visiblePermissionId: permission.publicId,
            tags: [{ publicId: songTagAssociationPublicId, tagId: songTag.publicId }],
            taggedFiles: [{
                publicId: fileSongTagPublicId,
                fileId: 8,
                songId: 7,
                file: {
                    id: 8,
                    tags: [{ publicId: fileTagAssignmentPublicId, fileTagId: fileTag.publicId }],
                },
            }],
            credits: [],
        });
        const hydrated = db3.hydrateView(db3.songSearchView, dto, references);

        expect(hydrated.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(hydrated.tags?.[0]?.tag).toEqual(
            references.require(db3.xSongTag, songTag.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file?.tags?.[0]?.fileTag).toEqual(
            references.require(db3.xFileTag, fileTag.publicId, "test"),
        );
        expectTypeOf(dto.aliases).toEqualTypeOf<string>();
        expectTypeOf(hydrated).toEqualTypeOf<db3.SongSearchClient>();
    });

    it("hydrates the File search view with normalized reference relations", () => {
        const references = db3.createDashboardReferenceStore();
        const permission = {
            id: 4,
            publicId: permissionPublicId,
            name: "members",
            description: "",
            isVisibility: true,
            sortOrder: 1,
            significance: null,
            color: null,
            iconName: null,
        };
        const fileTag = {
            publicId: fileTagPublicId,
            text: "Partition",
            description: "",
            color: null,
            sortOrder: 1,
            significance: db3.FileTagSignificance.Partition,
        };
        const instrument = {
            publicId: instrumentPublicId,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            functionalGroup: hydratedGroup,
            instrumentTags: [],
        };
        db3.registerDashboardReferences(references, {
            permission: [permission],
            fileTag: [fileTag],
            instrumentFunctionalGroup: [hydratedGroup],
            instrument: [instrument],
            eventStatus: [{
                publicId: eventStatusPublicId,
                label: "Confirmed",
                description: "",
                color: null,
                sortOrder: 1,
                significance: null,
                iconName: null,
                isDeleted: false,
            }],
            eventType: [{
                publicId: eventTypePublicId,
                text: "Concert",
                description: "",
                color: null,
                sortOrder: 1,
                significance: null,
                iconName: null,
                isDeleted: false,
            }],
        });

        const dto = db3.fileSearchView.parseDto({
            id: 8,
            fileLeafName: "score.pdf",
            description: "",
            externalURI: null,
            visiblePermissionId: permission.publicId,
            tags: [{ publicId: fileTagAssignmentPublicId, fileTagId: fileTag.publicId }],
            taggedSongs: [{ publicId: fileSongTagPublicId, song: { id: 7, name: "A song" } }],
            taggedEvents: [
                {
                    publicId: fileEventTagPublicId,
                    event: {
                        id: 9,
                        name: "A concert",
                        startsAt: new Date("2026-06-01T19:00:00Z"),
                        statusId: eventStatusPublicId,
                        typeId: eventTypePublicId,
                    },
                },
            ],
            taggedInstruments: [{ publicId: fileInstrumentTagPublicId, instrumentId: instrument.publicId }],
            taggedWikiPages: [{ publicId: fileWikiPageTagPublicId, wikiPage: { id: 12, slug: "repertoire" } }],
        });
        const hydrated = db3.hydrateView(db3.fileSearchView, dto, references);

        expect(hydrated.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(hydrated.tags).toHaveLength(1);
        expect(hydrated.tags?.[0]?.fileTag).toEqual(
            references.require(db3.xFileTag, fileTag.publicId, "test"),
        );
        expect(hydrated.taggedSongs).toHaveLength(1);
        expect(hydrated.taggedSongs?.[0]?.song.name).toBe("A song");
        expect(hydrated.taggedEvents).toHaveLength(1);
        expect(hydrated.taggedEvents?.[0]?.event.name).toBe("A concert");
        expect(hydrated.taggedInstruments).toHaveLength(1);
        expect(hydrated.taggedInstruments?.[0]?.instrument).toEqual(
            references.require(db3.xInstrument, instrument.publicId, "test"),
        );
        expect(hydrated.taggedWikiPages).toHaveLength(1);
        expect(hydrated.taggedWikiPages?.[0]?.wikiPage.slug).toBe("repertoire");
        expectTypeOf(dto.description).toEqualTypeOf<string>();
        expectTypeOf(hydrated).toEqualTypeOf<db3.FileSearchClient>();
    });

    it("hydrates the File detail view with its relationship panels", () => {
        const references = db3.createDashboardReferenceStore();
        const permission = {
            id: 4,
            publicId: permissionPublicId,
            name: "members",
            description: "",
            isVisibility: true,
            sortOrder: 1,
            significance: null,
            color: null,
            iconName: null,
        };
        const fileTag = {
            publicId: fileTagPublicId,
            text: "Partition",
            description: "",
            color: null,
            sortOrder: 1,
            significance: db3.FileTagSignificance.Partition,
        };
        const instrument = {
            publicId: instrumentPublicId,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            functionalGroup: hydratedGroup,
            instrumentTags: [],
        };
        db3.registerDashboardReferences(references, {
            permission: [permission],
            fileTag: [fileTag],
            instrumentFunctionalGroup: [hydratedGroup],
            instrument: [instrument],
            eventType: [{
                publicId: eventTypePublicId,
                text: "Concert",
                description: "",
                color: null,
                sortOrder: 1,
                significance: null,
                iconName: null,
                isDeleted: false,
            }],
        });

        const selection = db3.fileDetailView.getSelectionArgs({
            filter: { items: [] },
            authorization: db3.createDB3Authorization(null, new PermissionSet([])),
        });
        expect(selection).toMatchObject({
            select: {
                customData: true,
                isDeleted: true,
                frontpageGalleryItems: { select: { id: true } },
                parentFile: { select: { id: true, fileLeafName: true } },
                childFiles: { select: { id: true, fileLeafName: true } },
                previewFile: { select: { id: true, fileLeafName: true } },
                previewForFile: { select: { id: true, fileLeafName: true } },
                pinnedForSongs: { select: { id: true, name: true } },
            },
        });

        const dto = db3.fileDetailView.parseDto({
            id: 8,
            fileLeafName: "score.pdf",
            description: "",
            customData: "{\"width\":1200}",
            externalURI: null,
            fileCreatedAt: null,
            parentFileId: null,
            previewFileId: null,
            isDeleted: true,
            visiblePermissionId: permission.publicId,
            tags: [{ publicId: fileTagAssignmentPublicId, fileTagId: fileTag.publicId }],
            taggedUsers: [{ publicId: fileUserTagPublicId, user: { id: 13, name: "Ada" } }],
            taggedSongs: [{ publicId: fileSongTagPublicId, song: { id: 14, name: "A song" } }],
            taggedEvents: [{
                publicId: fileEventTagPublicId,
                event: {
                    id: 15,
                    name: "A concert",
                    startsAt: null,
                    statusId: null,
                    typeId: eventTypePublicId,
                },
            }],
            taggedInstruments: [{ publicId: fileInstrumentTagPublicId, instrumentId: instrument.publicId }],
            taggedWikiPages: [{ publicId: fileWikiPageTagPublicId, wikiPage: { id: 16, slug: "repertoire" } }],
            frontpageGalleryItems: [{ id: 90 }],
            parentFile: { id: 7, fileLeafName: "source.pdf" },
            childFiles: [{ id: 9, fileLeafName: "part.pdf" }],
            previewFile: { id: 10, fileLeafName: "preview.png" },
            previewForFile: [{ id: 11, fileLeafName: "poster.pdf" }],
            pinnedForSongs: [{ id: 12, name: "A song" }],
        });
        const hydrated = db3.hydrateView(db3.fileDetailView, dto, references);

        expect(hydrated.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(dto).not.toHaveProperty("isDeleted");
        expect(hydrated.tags?.[0]?.fileTag).toEqual(
            references.require(db3.xFileTag, fileTag.publicId, "test"),
        );
        expect(hydrated.taggedUsers).toEqual([{ publicId: fileUserTagPublicId, user: { id: 13, name: "Ada" } }]);
        expect(hydrated.taggedSongs).toEqual([{ publicId: fileSongTagPublicId, song: { id: 14, name: "A song" } }]);
        expect(hydrated.taggedEvents?.[0]?.event.name).toBe("A concert");
        expect(hydrated.taggedInstruments?.[0]?.instrument).toEqual(
            references.require(db3.xInstrument, instrument.publicId, "test"),
        );
        expect(hydrated.taggedWikiPages).toEqual([{
            publicId: fileWikiPageTagPublicId,
            wikiPage: { id: 16, slug: "repertoire" },
        }]);
        expect(hydrated.frontpageGalleryItems).toEqual([{ id: 90 }]);
        expect(hydrated.parentFile).toEqual({ id: 7, fileLeafName: "source.pdf" });
        expect(hydrated.childFiles).toEqual([{ id: 9, fileLeafName: "part.pdf" }]);
        expect(hydrated.previewFile).toEqual({ id: 10, fileLeafName: "preview.png" });
        expect(hydrated.previewForFile).toEqual([{ id: 11, fileLeafName: "poster.pdf" }]);
        expect(hydrated.pinnedForSongs).toEqual([{ id: 12, name: "A song" }]);
        expectTypeOf(hydrated).toEqualTypeOf<db3.FileDetailClient>();
    });

    it("builds Event search selections from the authenticated actor, never client identity", () => {
        const authorization = db3.createDB3Authorization({ id: 42 }, new PermissionSet([]));
        const selection = db3.eventSearchView.getSelectionArgs({
            filter: { items: [] },
            authorization,
        });

        expect(selection.select.responses.where).toEqual({ userId: 42 });
        expect(selection.select.segments.select.responses.where).toEqual({ userId: 42 });
        expect(selection.select.expectedAttendanceUserTag.select.userAssignments.where)
            .toEqual({ userId: 42 });
    });

    it("hydrates Event search data into one typed client shape and preserves omitted collections", () => {
        const references = db3.createDashboardReferenceStore();
        const eventType = {
            publicId: eventTypePublicId, text: "Concert", description: "", color: null, sortOrder: 1,
            significance: null, iconName: null, isDeleted: false,
        };
        const eventStatus = {
            publicId: eventStatusPublicId, label: "Confirmed", description: "", color: null, sortOrder: 1,
            significance: null, iconName: null, isDeleted: false,
        };
        const eventTag = {
            publicId: eventTagPublicId, text: "Public", description: "", color: null, sortOrder: 1,
            significance: null, visibleOnFrontpage: true,
        };
        db3.registerDashboardReferences(references, {
            eventType: [eventType],
            eventStatus: [eventStatus],
            eventTag: [eventTag],
        });

        const dto = db3.eventSearchView.parseDto({
            id: 1,
            name: "Actor-scoped event",
            locationDescription: "",
            locationURL: "",
            startsAt: null,
            durationMillis: BigInt(3_600_000),
            isAllDay: false,
            typeId: eventType.publicId,
            statusId: eventStatus.publicId,
            tags: [{ publicId: eventTagAssignmentPublicId, eventTagId: eventTag.publicId }],
            responses: [{ id: 11, userId: 42, instrumentId: null, isInvited: true, userComment: null }],
            expectedAttendanceUserTag: {
                publicId: userTagPublicId,
                userAssignments: [{ userId: 42 }],
            },
        });
        const hydrated = db3.hydrateView(db3.eventSearchView, dto, references);

        expect(hydrated.type).toEqual(
            references.require(db3.xEventType, eventType.publicId, "test"),
        );
        expect(hydrated.status).toEqual(
            references.require(db3.xEventStatus, eventStatus.publicId, "test"),
        );
        expect(hydrated.tags?.[0]?.eventTag).toEqual(
            references.require(db3.xEventTag, eventTag.publicId, "test"),
        );
        expect(hydrated.expectedAttendanceUserTag?.userAssignments?.[0]?.userId).toBe(42);
        expect(hydrated.dateRange).toBeInstanceOf(DateTimeRange);
        expect("startsAt" in hydrated).toBe(false);
        expect(hydrated.segments).toBeUndefined();
        expect(hydrated.songLists).toBeUndefined();
        expectTypeOf(hydrated).toEqualTypeOf<db3.EventSearchClient>();
    });

    it("hydrates complete Event timing tuples into DateTimeRange value objects", () => {
        const references = db3.createDashboardReferenceStore();
        const segmentStart = new Date("2026-09-20T19:00:00Z");
        const dto = db3.eventSearchView.parseDto({
            id: 1,
            name: "Timed event",
            locationDescription: "",
            locationURL: "",
            startsAt: null,
            durationMillis: BigInt(86_400_000),
            isAllDay: true,
            tags: [],
            segments: [
                {
                    id: 2,
                    startsAt: segmentStart,
                    durationMillis: BigInt(3_600_000),
                    isAllDay: false,
                },
                {
                    id: 3,
                    startsAt: segmentStart,
                    durationMillis: BigInt(3_600_000),
                },
            ],
        });

        const hydrated = db3.hydrateView(db3.eventSearchView, dto, references);
        const completeSegment = hydrated.segments?.[0];
        const incompleteSegment = hydrated.segments?.[1];

        expect(hydrated.dateRange).toBeInstanceOf(DateTimeRange);
        expect(hydrated.dateRange?.isTBD()).toBe(true);
        expect(hydrated.dateRange?.getSpec()).toEqual({
            startsAtDateTime: null,
            durationMillis: 86_400_000,
            isAllDay: true,
        });
        expect(completeSegment?.dateRange).toBeInstanceOf(DateTimeRange);
        expect(completeSegment?.dateRange?.getBounds()).toEqual({
            start: segmentStart,
            end: new Date("2026-09-20T20:00:00Z"),
        });
        expect(incompleteSegment?.dateRange).toBeUndefined();
        expect("startsAt" in completeSegment!).toBe(false);
        expect("durationMillis" in incompleteSegment!).toBe(false);

        type EventRawTimingKeys = Extract<keyof db3.EventSearchClient,
            "startsAt" | "durationMillis" | "isAllDay">;
        type Segment = NonNullable<db3.EventSearchClient["segments"]>[number];
        type SegmentRawTimingKeys = Extract<keyof Segment,
            "startsAt" | "durationMillis" | "isAllDay">;
        expectTypeOf<EventRawTimingKeys>().toEqualTypeOf<never>();
        expectTypeOf<SegmentRawTimingKeys>().toEqualTypeOf<never>();
        expectTypeOf(hydrated.dateRange).toEqualTypeOf<DateTimeRange>();
    });

    it("applies nested Event view authorization before returning its DTO", async () => {
        const startsAt = new Date("2026-09-20T18:00:00Z");
        const findMany = vi.fn(async (_args: unknown) => [{
            id: 1,
            revision: 1,
            name: "Actor-scoped event",
            typeId: null,
            locationDescription: "",
            locationURL: "",
            statusId: null,
            relevanceClassOverride: null,
            descriptionWikiPageId: null,
            segmentBehavior: null,
            startsAt,
            durationMillis: BigInt(3_600_000),
            isAllDay: false,
            createdByUserId: 42,
            visiblePermissionId: null,
            isDeleted: false,
            expectedAttendanceUserTagId: 5,
            tags: [{
                id: 10,
                publicId: eventTagAssignmentPublicId,
                eventTagId: 4,
                eventTag: { publicId: eventTagPublicId },
            }],
            responses: [{ id: 11, userId: 42, instrumentId: null, isInvited: true, userComment: null }],
            segments: [{
                id: 20,
                name: "Main",
                startsAt,
                durationMillis: BigInt(3_600_000),
                isAllDay: false,
                statusId: null,
                responses: [{ id: 21, userId: 42, attendanceId: null }],
            }],
            songLists: [],
            expectedAttendanceUserTag: {
                id: 5,
                publicId: userTagPublicId,
                userAssignments: [{ id: 22, userId: 42 }],
            },
            descriptionWikiPage: {
                id: 30,
                createdByUserId: 42,
                visiblePermissionId: null,
                currentRevision: {
                    id: 31,
                    content: "Event details",
                },
            },
        }]);
        const permissionNames = [
            Permission.always_grant,
            Permission.public,
            Permission.login,
            Permission.view_events,
            Permission.view_events_nonpublic,
            Permission.view_users_basic_info,
            Permission.view_wiki_pages,
            Permission.view_wiki_page_revisions,
        ];
        const effectivePermissions = new PermissionSet(permissionNames.map((name, index) => ({
            id: index + 1,
            name,
        })));

        const result = await queryTable({
            table: {
                tableID: db3.xEvent.tableID,
                tableName: db3.xEvent.tableName,
                viewID: db3.eventSearchView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "event-search-view-test",
        }, {
            user: { id: 42 } as any,
            effectivePermissions,
        }, {
            Event: { findMany },
        } as any);

        expect(result.items).toEqual([expect.objectContaining({
            id: 1,
            responses: [expect.objectContaining({ userId: 42 })],
            segments: [expect.objectContaining({
                responses: [expect.objectContaining({ userId: 42 })],
            })],
            expectedAttendanceUserTag: expect.objectContaining({
                userAssignments: [expect.objectContaining({ userId: 42 })],
            }),
            descriptionWikiPage: {
                id: 30,
                currentRevision: { id: 31, content: "Event details" },
            },
        })]);
        expect(result.items[0]).not.toHaveProperty("createdByUserId");
        expect(result.items[0]).not.toHaveProperty("isDeleted");
        expect(result.items[0]!.descriptionWikiPage).not.toHaveProperty("createdByUserId");
        expect(result.items[0]!.descriptionWikiPage).not.toHaveProperty("visiblePermissionId");

        const queryArgs = findMany.mock.calls[0]![0] as any;
        expect(queryArgs.select.responses.where.AND[0]).toEqual({ userId: 42 });
        expect(queryArgs.select.segments.select.responses.where.AND[0]).toEqual({ userId: 42 });
        expect(queryArgs.select.expectedAttendanceUserTag.select.userAssignments.where.AND[0])
            .toEqual({ userId: 42 });
    });

    it("queries Wiki Event context through the named view and projects classification identities", async () => {
        const startsAt = new Date("2026-09-20T18:00:00Z");
        const findMany = vi.fn(async () => [{
            id: 17,
            name: "Wiki-linked event",
            createdByUserId: 42,
            visiblePermissionId: null,
            isDeleted: false,
            typeId: 101,
            type: { publicId: eventTypePublicId },
            statusId: 102,
            status: { publicId: eventStatusPublicId },
            uid: "event-uid",
            startsAt,
            endDateTime: new Date("2026-09-20T19:00:00Z"),
            isAllDay: false,
            durationMillis: BigInt(3_600_000),
            segmentBehavior: "Sets",
            segments: [{
                id: 18,
                name: "Main set",
                statusId: 103,
                status: { publicId: eventStatusPublicId },
                uid: "segment-uid",
                startsAt,
                isAllDay: false,
                durationMillis: BigInt(3_600_000),
            }],
        }]);
        const permissionNames = [
            Permission.always_grant,
            Permission.public,
            Permission.view_events_nonpublic,
        ];
        const effectivePermissions = new PermissionSet(permissionNames.map((name, index) => ({
            id: index + 1,
            name,
        })));

        const result = await queryView({
            view: db3.eventWikiPageContextView,
            filter: { items: [], tableParams: { eventId: 17 } },
            orderBy: undefined,
            take: 1,
            cmdbQueryContext: "wiki-event-context-view-test",
        }, {
            // This focused authorization fixture only needs the actor identity.
            user: { id: 42 } as any,
            effectivePermissions,
        }, new db3.DB3ReferenceStore(), {
            Event: { findMany },
        } as any); // The focused database double deliberately implements only the queried Event delegate.

        expect(result.items).toEqual([{
            id: 17,
            name: "Wiki-linked event",
            typeId: eventTypePublicId,
            statusId: eventStatusPublicId,
            uid: "event-uid",
            startsAt,
            endDateTime: new Date("2026-09-20T19:00:00Z"),
            isAllDay: false,
            durationMillis: BigInt(3_600_000),
            segmentBehavior: "Sets",
            segments: [{
                id: 18,
                name: "Main set",
                statusId: eventStatusPublicId,
                uid: "segment-uid",
                startsAt,
                isAllDay: false,
                durationMillis: BigInt(3_600_000),
            }],
        }]);
        expect(result.items[0]).not.toHaveProperty("type");
        expect(result.items[0]).not.toHaveProperty("status");
        expect(result.items[0]!.segments?.[0]).not.toHaveProperty("status");
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            take: 1,
            select: expect.objectContaining({
                type: { select: { publicId: true } },
                status: { select: { publicId: true } },
            }),
        }));
        expectTypeOf(result.items).toEqualTypeOf<db3.EventWikiPageContextClient[]>();
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
            tags: [{
                id: 70,
                publicId: songTagAssociationPublicId,
                songId: 7,
                tagId: 20,
                tag: { publicId: songTagPublicId },
            }],
            taggedFiles: [{
                id: 80,
                publicId: fileSongTagPublicId,
                fileId: 8,
                songId: 7,
                file: {
                    id: 8,
                    uploadedByUserId: 100,
                    visiblePermissionId: null,
                    isDeleted: false,
                    tags: [{
                        id: 90,
                        publicId: fileTagAssignmentPublicId,
                        fileTagId: 30,
                        fileTag: { publicId: fileTagPublicId },
                    }],
                },
            }],
            credits: [{
                id: 100,
                publicId: songCreditPublicId,
                userId: 100,
                songId: 7,
                typeId: 2,
                type: { publicId: songCreditTypePublicId },
                year: "2026",
                comment: "",
                user: { id: 100, name: "Composer" },
            }],
        }]);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
            { id: 3, name: Permission.login },
            { id: 4, name: Permission.visibility_members },
            { id: 5, name: Permission.view_songs },
            { id: 6, name: Permission.view_files },
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
            tags: [{
                publicId: songTagAssociationPublicId,
                tagId: songTagPublicId,
            }],
            taggedFiles: [{
                publicId: fileSongTagPublicId,
                file: {
                    id: 8,
                    tags: [{
                        publicId: fileTagAssignmentPublicId,
                        fileTagId: fileTagPublicId,
                    }],
                },
            }],
            credits: [{
                publicId: songCreditPublicId,
                typeId: songCreditTypePublicId,
                user: { id: 100, name: "Composer" },
            }],
        });
        expect(result.items[0]).not.toHaveProperty("createdByUserId");
        expect(result.items[0]?.tags?.[0]).not.toHaveProperty("id");
        expect(result.items[0]?.taggedFiles?.[0]).not.toHaveProperty("fileId");
        expect(result.items[0]?.credits?.[0]).not.toHaveProperty("songId");
        expect(result.items[0]?.credits?.[0]).not.toHaveProperty("id");
    });

    it("hydrates the Song detail view, including its reusable File-card shape", () => {
        const references = db3.createDashboardReferenceStore();
        const permission = {
            id: 4,
            publicId: permissionPublicId,
            name: "members",
            description: "",
            isVisibility: true,
            sortOrder: 1,
            significance: null,
            color: null,
            iconName: null,
        };
        const songTag = { publicId: songTagPublicId, text: "March", description: "", color: null, sortOrder: 1, significance: null, group: null, indicator: null, indicatorCssClass: null };
        const fileTag = { publicId: fileTagPublicId, text: "Partition", description: "", color: null, sortOrder: 1, significance: db3.FileTagSignificance.Partition };
        const instrument = {
            publicId: instrumentPublicId,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            functionalGroup: hydratedGroup,
            instrumentTags: [],
        };
        db3.registerDashboardReferences(references, {
            permission: [permission],
            songTag: [songTag],
            fileTag: [fileTag],
            instrumentFunctionalGroup: [hydratedGroup],
            instrument: [instrument],
        });

        const dto = db3.songDetailView.parseDto({
            id: 7,
            name: "A song",
            aliases: "",
            description: "Detail description",
            startBPM: null,
            endBPM: null,
            introducedYear: null,
            lengthSeconds: null,
            visiblePermissionId: permission.publicId,
            pinnedRecordingId: null,
            tags: [{ publicId: songTagAssociationPublicId, tagId: songTag.publicId }],
            taggedFiles: [{
                publicId: fileSongTagPublicId,
                fileId: 8,
                file: {
                    id: 8,
                    fileLeafName: "score.pdf",
                    description: "",
                    externalURI: null,
                    fileCreatedAt: null,
                    parentFileId: null,
                    previewFileId: null,
                    visiblePermissionId: permission.publicId,
                    tags: [{ publicId: fileTagAssignmentPublicId, fileTagId: fileTag.publicId }],
                    taggedUsers: [],
                    taggedSongs: [],
                    taggedEvents: [],
                    taggedInstruments: [{ publicId: fileInstrumentTagPublicId, instrumentId: instrument.publicId }],
                    taggedWikiPages: [],
                },
            }],
            credits: [],
        });
        const hydrated = db3.hydrateView(db3.songDetailView, dto, references);

        expect(hydrated.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(hydrated.tags?.[0]?.tag).toEqual(
            references.require(db3.xSongTag, songTag.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file.tags?.[0]?.fileTag).toEqual(
            references.require(db3.xFileTag, fileTag.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file.taggedInstruments?.[0]?.instrument).toEqual(
            references.require(db3.xInstrument, instrument.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file.taggedEvents).toEqual([]);
        expect(hydrated.credits).toEqual([]);
        expectTypeOf(dto.aliases).toEqualTypeOf<string>();
        expectTypeOf(hydrated).toEqualTypeOf<db3.SongDetailClient>();
    });

    it("projects the Song detail DTO recursively without leaking authorization support fields", async () => {
        const uploadedAt = new Date("2026-01-02T12:00:00Z");
        const findMany = vi.fn(async () => [{
            id: 7,
            name: "A song",
            aliases: "",
            description: "Detail description",
            startBPM: null,
            endBPM: null,
            introducedYear: null,
            lengthSeconds: null,
            createdByUserId: 100,
            visiblePermissionId: 3,
            visiblePermission: { publicId: permissionPublicId },
            pinnedRecordingId: null,
            isDeleted: false,
            tags: [{
                id: 70,
                publicId: songTagAssociationPublicId,
                songId: 7,
                tagId: 20,
                tag: { publicId: songTagPublicId },
            }],
            taggedFiles: [{
                id: 80,
                publicId: fileSongTagPublicId,
                fileId: 8,
                songId: 7,
                file: {
                    id: 8,
                    fileLeafName: "score.pdf",
                    description: "",
                    uploadedAt,
                    uploadedByUserId: 100,
                    visiblePermissionId: 3,
                    visiblePermission: { publicId: permissionPublicId },
                    isDeleted: false,
                    sizeBytes: 123,
                    storedLeafName: "stored.pdf",
                    mimeType: "application/pdf",
                    externalURI: null,
                    fileCreatedAt: null,
                    parentFileId: null,
                    previewFileId: null,
                    tags: [{
                        id: 90,
                        publicId: fileTagAssignmentPublicId,
                        fileTagId: 30,
                        fileTag: { publicId: fileTagPublicId },
                    }],
                    taggedUsers: [],
                    taggedSongs: [{
                        id: 91,
                        publicId: fileSongTagPublicId,
                        songId: 9,
                        song: {
                            id: 9,
                            name: "Private related song",
                            createdByUserId: 100,
                            visiblePermissionId: null,
                            isDeleted: false,
                        },
                    }],
                    taggedEvents: [],
                    taggedInstruments: [],
                    taggedWikiPages: [],
                },
            }],
            credits: [],
        }]);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.visibility_members },
            { id: 4, name: Permission.view_songs },
            { id: 5, name: Permission.view_files },
            { id: 6, name: Permission.public },
        ]);

        const result = await queryTable({
            table: {
                tableID: db3.xSong.tableID,
                tableName: db3.xSong.tableName,
                viewID: db3.songDetailView.viewID,
            },
            orderBy: undefined,
            filter: { items: [], tableParams: { songId: 7 } },
            cmdbQueryContext: "song-detail-view-test",
        }, {
            user: { id: 100 } as any,
            effectivePermissions,
        }, {
            Song: { findMany },
        } as any);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({
            id: 7,
            name: "A song",
            tags: [{
                publicId: songTagAssociationPublicId,
                tagId: songTagPublicId,
            }],
            taggedFiles: [{
                publicId: fileSongTagPublicId,
                file: {
                    id: 8,
                    fileLeafName: "score.pdf",
                    tags: [{
                        publicId: fileTagAssignmentPublicId,
                        fileTagId: fileTagPublicId,
                    }],
                    taggedSongs: [{
                        publicId: fileSongTagPublicId,
                        song: { id: 9, name: "Private related song" },
                    }],
                },
            }],
        });
        expect(result.items[0]).not.toHaveProperty("isDeleted");
        expect(result.items[0]?.taggedFiles?.[0]).not.toHaveProperty("fileId");
        expect(result.items[0]?.taggedFiles?.[0]?.file).not.toHaveProperty("isDeleted");
        expect(result.items[0]?.taggedFiles?.[0]?.file?.taggedSongs?.[0]?.song)
            .not.toHaveProperty("createdByUserId");
        expect(findMany).toHaveBeenCalledOnce();
    });

    it("hydrates EventSongList persistence collections into one client value object", () => {
        const dto = db3.eventSongListDetailView.parseDto({
            id: 50,
            name: "Concert set",
            description: "Main set",
            eventId: 5,
            sortOrder: 10,
            isOrdered: true,
            isActuallyPlayed: false,
            songs: [{
                id: 501,
                eventSongListId: 50,
                subtitle: "Open quietly",
                sortOrder: 20,
                songId: 7,
                song: {
                    id: 7,
                    name: "First song",
                    lengthSeconds: 120,
                    startBPM: 110,
                    endBPM: 120,
                    pinnedRecordingId: null,
                    tags: [{
                        publicId: songTagAssociationPublicId,
                        songId: 7,
                        tagId: songTagPublicId,
                    }],
                },
            }, {
                id: 502,
                eventSongListId: 50,
                subtitle: null,
                sortOrder: 40,
                songId: 8,
                song: {
                    id: 8,
                    name: "Second song",
                    lengthSeconds: null,
                    startBPM: 140,
                    endBPM: null,
                    pinnedRecordingId: null,
                    tags: [],
                },
            }],
            dividers: [{
                id: 601,
                eventSongListId: 50,
                subtitle: "Break",
                sortOrder: 10,
                color: null,
                isInterruption: true,
                isSong: false,
                subtitleIfSong: null,
                lengthSeconds: null,
                textStyle: null,
            }, {
                id: 602,
                eventSongListId: 50,
                subtitle: "Encore",
                sortOrder: 30,
                color: "blue",
                isInterruption: false,
                isSong: true,
                subtitleIfSong: "Guest feature",
                lengthSeconds: 30,
                textStyle: "Title",
            }],
        });

        const hydrated = db3.hydrateEventSongListDetailDto(dto);

        expect(hydrated.content).toBeInstanceOf(db3.EventSongListContent);
        expect(hydrated.content?.items.map(item => item.type)).toEqual([
            "divider", "song", "divider", "song",
        ]);
        expect(hydrated.content?.items.map(item => "index" in item ? item.index : null))
            .toEqual([0, 0, 1, 2]);
        expect(hydrated.content?.stats).toEqual({
            songCount: 2,
            durationSeconds: 120,
            songsOfUnknownDuration: 1,
            maxBpm: 140,
        });
        expect(hydrated.content?.toMarkdown()).toContain("**First song**");
        expect(hydrated.content?.toTSV()).toContain("First song");
        expect(hydrated).not.toHaveProperty("songs");
        expect(hydrated).not.toHaveProperty("dividers");
        expectTypeOf(hydrated).toEqualTypeOf<db3.EventSongListDetailClient>();
        expectTypeOf(hydrated.content).toEqualTypeOf<db3.EventSongListContent | undefined>();
    });

    it("adapts a hydrated EventSongList to ordered editor state and one legacy mutation boundary", () => {
        const client = db3.hydrateEventSongListDetailDto(
            db3.eventSongListDetailView.parseDto({
                id: 50,
                name: "Concert set",
                description: "Main set",
                eventId: 5,
                sortOrder: 10,
                isOrdered: true,
                isActuallyPlayed: false,
                songs: [{
                    id: 501,
                    eventSongListId: 50,
                    subtitle: "Open quietly",
                    sortOrder: 20,
                    songId: 7,
                    song: {
                        id: 7,
                        name: "First song",
                        lengthSeconds: 120,
                        startBPM: 110,
                        endBPM: 120,
                        pinnedRecordingId: null,
                        tags: [],
                    },
                }],
                dividers: [{
                    id: 601,
                    eventSongListId: 50,
                    subtitle: "Break",
                    sortOrder: 10,
                    color: null,
                    isInterruption: true,
                    isSong: false,
                    subtitleIfSong: null,
                    lengthSeconds: null,
                    textStyle: null,
                }],
            }),
        );

        const draft = db3.eventSongListClientToDraft(client);
        expect(draft?.items.map(item => item.type)).toEqual(["divider", "song"]);
        expect(draft).not.toHaveProperty("songs");
        expect(draft).not.toHaveProperty("dividers");

        draft!.items = [draft!.items[1]!, draft!.items[0]!];
        const mutation = db3.saveEventSongListCommand.serialize(draft!);

        expect(db3.EventSongListMutationCommandSchema.safeParse(mutation).success).toBe(true);
        expect(mutation).toMatchObject({
            id: 50,
            eventId: 5,
            songs: [{ id: 501, songId: 7, sortOrder: 0, subtitle: "Open quietly" }],
            dividers: [{ id: 601, sortOrder: 1, subtitle: "Break" }],
        });
        expect(db3.eventSongListDraftToClient(draft!).content?.items.map(item => item.type))
            .toEqual(["song", "divider"]);
        expectTypeOf(draft).toEqualTypeOf<db3.EventSongListDraft | undefined>();
    });

    it("replaces an edited setlist row without moving it", () => {
        const draft = db3.createEventSongListDraft({
            clientId: -1,
            eventId: 5,
            name: "New set",
        });
        draft.items = [{
            type: "divider",
            clientId: -10,
            color: null,
            isInterruption: false,
            isSong: false,
            subtitleIfSong: null,
            lengthSeconds: null,
            textStyle: null,
            subtitle: "First",
        }, {
            type: "divider",
            clientId: -11,
            color: null,
            isInterruption: false,
            isSong: false,
            subtitleIfSong: null,
            lengthSeconds: null,
            textStyle: null,
            subtitle: "Second",
        }];

        const rows = db3.getEventSongListDraftContent(draft).items;
        const firstRow = rows[0]!;
        expect(firstRow.type).toBe("divider");
        if (firstRow.type !== "divider") throw new Error("Expected the first row to be a divider.");
        const editedRows = db3.replaceEventSongListEditorRow(rows, firstRow.id, {
            ...firstRow,
            subtitle: "Edited first",
        });

        expect(editedRows.map(row => row.id)).toEqual([-10, -11]);
        expect(editedRows.map(row => row.type === "divider" ? row.subtitle : null))
            .toEqual(["Edited first", "Second"]);
        expect(rows[0]).toBe(firstRow);
    });

    it("does not create an editable EventSongList draft from an authorization-incomplete client", () => {
        const incomplete = db3.hydrateEventSongListDetailDto(
            db3.eventSongListDetailView.parseDto({ id: 50, songs: [], dividers: [] }),
        );
        const newDraft = db3.createEventSongListDraft({
            clientId: -1,
            eventId: 5,
            name: "New set",
        });

        expect(db3.eventSongListClientToDraft(incomplete)).toBeUndefined();
        expect(db3.saveEventSongListCommand.serialize(newDraft)).toEqual({
            eventId: 5,
            name: "New set",
            description: "",
            isActuallyPlayed: false,
            isOrdered: true,
            sortOrder: 0,
            songs: [],
            dividers: [],
        });
    });

    it("keeps EventSongList content unavailable when field authorization leaves an incomplete shape", () => {
        const missingCollection = db3.hydrateEventSongListDetailDto(
            db3.eventSongListDetailView.parseDto({ id: 50, songs: [] }),
        );
        const incompleteSong = db3.hydrateEventSongListDetailDto(
            db3.eventSongListDetailView.parseDto({
                id: 50,
                songs: [{
                    id: 501,
                    eventSongListId: 50,
                    subtitle: null,
                    sortOrder: 10,
                    songId: 7,
                    song: { id: 7 },
                }],
                dividers: [],
            }),
        );

        expect(missingCollection.content).toBeUndefined();
        expect(incompleteSong.content).toBeUndefined();
    });

    it("queries the EventSongList detail view with recursive authorization and no ID ordering", async () => {
        const findMany = vi.fn(async (_query: any) => [{
            id: 50,
            name: "Concert set",
            description: "Main set",
            eventId: 5,
            sortOrder: 10,
            isOrdered: true,
            isActuallyPlayed: false,
            songs: [{
                id: 501,
                eventSongListId: 50,
                subtitle: null,
                sortOrder: 10,
                songId: 7,
                song: {
                    id: 7,
                    name: "Visible song",
                    lengthSeconds: 120,
                    startBPM: 110,
                    endBPM: 120,
                    pinnedRecordingId: null,
                    createdByUserId: 42,
                    visiblePermissionId: null,
                    isDeleted: false,
                    tags: [{
                        id: 701,
                        publicId: songTagAssociationPublicId,
                        songId: 7,
                        tagId: 9,
                        tag: { publicId: songTagPublicId },
                    }],
                },
            }],
            dividers: [],
        }]);
        const permissionNames = [
            Permission.always_grant,
            Permission.public,
            Permission.login,
            Permission.view_events_nonpublic,
            Permission.view_songs,
        ];
        const effectivePermissions = new PermissionSet(permissionNames.map((name, index) => ({
            id: index + 1,
            name,
        })));

        const result = await queryTable({
            table: {
                tableID: db3.xEventSongList.tableID,
                tableName: db3.xEventSongList.tableName,
                viewID: db3.eventSongListDetailView.viewID,
            },
            orderBy: undefined,
            filter: { items: [], tableParams: { eventId: 5 } },
            cmdbQueryContext: "event-song-list-detail-view-test",
        }, {
            user: { id: 42 } as any,
            effectivePermissions,
        }, {
            EventSongList: { findMany },
        } as any);

        expect(result.items[0]).toMatchObject({
            id: 50,
            songs: [{ song: { id: 7, name: "Visible song" } }],
            dividers: [],
        });
        expect(result.items[0]?.songs?.[0]?.song).not.toHaveProperty("createdByUserId");
        const query = findMany.mock.calls[0]![0];
        expect(query.orderBy).toEqual([{ sortOrder: "asc" }]);
        expect(query.select.songs.orderBy).toEqual({ sortOrder: "asc" });
        expect(query.select.songs.where).toBeDefined();
        expect(query.select.dividers.orderBy).toEqual({ sortOrder: "asc" });
    });

    it("returns an explicitly incomplete EventSongList DTO when fields are unauthorized", async () => {
        const findMany = vi.fn(async () => [{
            id: 50,
            name: "Restricted set",
            description: "Restricted",
            eventId: 5,
            sortOrder: 10,
            isOrdered: true,
            isActuallyPlayed: false,
            songs: [],
            dividers: [],
        }]);
        const effectivePermissions = new PermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
        ]);

        const result = await queryTable({
            table: {
                tableID: db3.xEventSongList.tableID,
                tableName: db3.xEventSongList.tableName,
                viewID: db3.eventSongListDetailView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "restricted-event-song-list-detail-view-test",
        }, {
            user: null,
            effectivePermissions,
        }, {
            EventSongList: { findMany },
        } as any);

        expect(result.items).toEqual([{ id: 50 }]);
        const dto = db3.eventSongListDetailView.parseDto(result.items[0]);
        expect(db3.hydrateEventSongListDetailDto(dto).content).toBeUndefined();
    });

    it("reports the exact missing reference path", () => {
        const references = db3.createDashboardReferenceStore();
        db3.registerDashboardReferences(references, {
            instrumentFunctionalGroup: [hydratedGroup],
        });
        const dto = db3.instrumentDashboardView.parseDto({
            publicId: instrumentPublicId,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            instrumentTags: [{
                publicId: tagAssociationPublicId,
                tagId: tagPublicId,
            }],
        });

        expect(() => db3.hydrateView(db3.instrumentDashboardView, dto, references))
            .toThrow(`Instrument(${instrumentPublicId}).instrumentTags[0].tagId`);
    });
});
