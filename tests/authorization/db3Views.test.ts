import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { authorizeAndProjectDB3ViewModel } from "@db3/server/db3PublicIds";
import { queryTable } from "@db3/server/db3QueryCore";
import { validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { DateTimeRange } from "shared/time";

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
    it("derives ordinary selections from DTO schemas and preserves explicit query additions", () => {
        const context = {
            filter: { items: [] },
            authorization: db3.createDB3Authorization(null, new PermissionSet([])),
        };

        expect(db3.eventTypeEditorView.getSelectionArgs(context)).toEqual({
            select: {
                id: true,
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
                    file: { select: { id: true, fileLeafName: true } },
                    createdByUser: { select: { id: true, name: true } },
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

        expectTypeOf<db3.DbPayloadOf<typeof db3.eventTypeEditorView>>()
            .toMatchTypeOf<{ id: number; text: string }>();
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
                tagId: 17,
                tag: {
                    id: 17,
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
                id: 16,
                tagId: 17,
                tag: {
                    id: 17,
                    text: "Policy",
                    description: "Policy page",
                    color: null,
                    sortOrder: 1,
                    significance: "Policy",
                },
            }],
        }]);
        expect(result.items[0]).not.toHaveProperty("slug");
        expect(findMany).toHaveBeenCalledOnce();
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

    it("hydrates the File search view without restoring authorization-omitted relations", () => {
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
        const fileTag = {
            id: 30,
            text: "Partition",
            description: "",
            color: null,
            sortOrder: 1,
            significance: db3.FileTagSignificance.Partition,
        };
        const instrument = {
            id: 40,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            functionalGroup: group,
            instrumentTags: [],
        };
        references.register(db3.permissionEntity, [permission]);
        references.register(db3.fileTagEntity, [fileTag]);
        references.register(db3.instrumentEntity, [instrument]);

        const dto = db3.fileSearchView.parseDto({
            id: 8,
            fileLeafName: "score.pdf",
            visiblePermissionId: permission.id,
            tags: [{ id: 80, fileTagId: fileTag.id }],
            taggedSongs: [{ id: 81, song: { id: 7, name: "A song" } }],
            taggedInstruments: [{ id: 82, instrumentId: instrument.id }],
        });
        const hydrated = db3.hydrateView(db3.fileSearchView, dto, references);

        expect(hydrated.visiblePermission).toBe(permission);
        expect(hydrated.tags?.[0]?.fileTag).toBe(fileTag);
        expect(hydrated.taggedSongs?.[0]?.song.name).toBe("A song");
        expect(hydrated.taggedInstruments?.[0]?.instrument).toBe(instrument);
        expect(hydrated.taggedEvents).toBeUndefined();
        expect(hydrated.taggedWikiPages).toBeUndefined();
        expectTypeOf(dto.description).toEqualTypeOf<string | undefined>();
        expectTypeOf(hydrated).toEqualTypeOf<db3.FileSearchClient>();
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
        const references = new db3.DB3ReferenceStore();
        const eventType = {
            id: 2, text: "Concert", description: "", color: null, sortOrder: 1,
            significance: null, iconName: null, isDeleted: false,
        };
        const eventStatus = {
            id: 3, label: "Confirmed", description: "", color: null, sortOrder: 1,
            significance: null, iconName: null, isDeleted: false,
        };
        const eventTag = {
            id: 4, text: "Public", description: "", color: null, sortOrder: 1,
            significance: null, visibleOnFrontpage: true,
        };
        references.register(db3.eventTypeEntity, [eventType]);
        references.register(db3.eventStatusEntity, [eventStatus]);
        references.register(db3.eventTagEntity, [eventTag]);

        const dto = db3.eventSearchView.parseDto({
            id: 1,
            name: "Actor-scoped event",
            typeId: eventType.id,
            statusId: eventStatus.id,
            tags: [{ id: 10, eventTagId: eventTag.id }],
            responses: [{ id: 11, userId: 42, instrumentId: null, isInvited: true, userComment: null }],
            expectedAttendanceUserTag: {
                id: 5,
                userAssignments: [{ id: 12, userId: 42 }],
            },
        });
        const hydrated = db3.hydrateView(db3.eventSearchView, dto, references);

        expect(hydrated.type).toBe(eventType);
        expect(hydrated.status).toBe(eventStatus);
        expect(hydrated.tags?.[0]?.eventTag).toBe(eventTag);
        expect(hydrated.expectedAttendanceUserTag?.userAssignments?.[0]?.userId).toBe(42);
        expect(hydrated.dateRange).toBeUndefined();
        expect("startsAt" in hydrated).toBe(false);
        expect(hydrated.segments).toBeUndefined();
        expect(hydrated.songLists).toBeUndefined();
        expectTypeOf(hydrated).toEqualTypeOf<db3.EventSearchClient>();
    });

    it("hydrates complete Event timing tuples into DateTimeRange value objects", () => {
        const references = new db3.DB3ReferenceStore();
        const segmentStart = new Date("2026-09-20T19:00:00Z");
        const dto = db3.eventSearchView.parseDto({
            id: 1,
            startsAt: null,
            durationMillis: BigInt(86_400_000),
            isAllDay: true,
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
        expectTypeOf(hydrated.dateRange).toEqualTypeOf<DateTimeRange | undefined>();
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
            tags: [{ id: 10, eventTagId: 4 }],
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
                userAssignments: [{ id: 22, userId: 42 }],
            },
            descriptionWikiPage: null,
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
        })]);
        expect(result.items[0]).not.toHaveProperty("createdByUserId");
        expect(result.items[0]).not.toHaveProperty("isDeleted");

        const queryArgs = findMany.mock.calls[0]![0] as any;
        expect(queryArgs.select.responses.where.AND[0]).toEqual({ userId: 42 });
        expect(queryArgs.select.segments.select.responses.where.AND[0]).toEqual({ userId: 42 });
        expect(queryArgs.select.expectedAttendanceUserTag.select.userAssignments.where.AND[0])
            .toEqual({ userId: 42 });
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

    it("hydrates the Song detail view, including its reusable File detail shape", () => {
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
        const instrument = {
            id: 40,
            name: "Trumpet",
            description: "",
            autoAssignFileLeafRegex: null,
            sortOrder: 1,
            functionalGroupId: groupPublicId,
            functionalGroup: group,
            instrumentTags: [],
        };
        references.register(db3.permissionEntity, [permission]);
        references.register(db3.songTagEntity, [songTag]);
        references.register(db3.fileTagEntity, [fileTag]);
        references.register(db3.instrumentEntity, [instrument]);

        const dto = db3.songDetailView.parseDto({
            id: 7,
            name: "A song",
            description: "Detail description",
            visiblePermissionId: permission.id,
            tags: [{ id: 70, tagId: songTag.id }],
            taggedFiles: [{
                id: 80,
                fileId: 8,
                file: {
                    id: 8,
                    fileLeafName: "score.pdf",
                    visiblePermissionId: permission.id,
                    tags: [{ id: 90, fileTagId: fileTag.id }],
                    taggedInstruments: [{ id: 100, instrumentId: instrument.id }],
                },
            }],
        });
        const hydrated = db3.hydrateView(db3.songDetailView, dto, references);

        expect(hydrated.visiblePermission).toBe(permission);
        expect(hydrated.tags?.[0]?.tag).toBe(songTag);
        expect(hydrated.taggedFiles?.[0]?.file.visiblePermission).toBe(permission);
        expect(hydrated.taggedFiles?.[0]?.file.tags?.[0]?.fileTag).toBe(fileTag);
        expect(hydrated.taggedFiles?.[0]?.file.taggedInstruments?.[0]?.instrument).toBe(instrument);
        expect(hydrated.taggedFiles?.[0]?.file.taggedEvents).toBeUndefined();
        expect(hydrated.credits).toBeUndefined();
        expectTypeOf(dto.aliases).toEqualTypeOf<string | undefined>();
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
            pinnedRecordingId: null,
            isDeleted: false,
            tags: [{ id: 70, songId: 7, tagId: 20 }],
            taggedFiles: [{
                id: 80,
                fileId: 8,
                songId: 7,
                file: {
                    id: 8,
                    fileLeafName: "score.pdf",
                    description: "",
                    uploadedAt,
                    uploadedByUserId: 100,
                    visiblePermissionId: 3,
                    isDeleted: false,
                    sizeBytes: 123,
                    storedLeafName: "stored.pdf",
                    mimeType: "application/pdf",
                    externalURI: null,
                    fileCreatedAt: null,
                    parentFileId: null,
                    previewFileId: null,
                    tags: [{ id: 90, fileTagId: 30 }],
                    taggedUsers: [],
                    taggedSongs: [{
                        id: 91,
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
            taggedFiles: [{
                id: 80,
                file: {
                    id: 8,
                    fileLeafName: "score.pdf",
                    tags: [{ id: 90, fileTagId: 30 }],
                    taggedSongs: [{
                        id: 91,
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
                    tags: [{ id: 701, songId: 7, tagId: 9 }],
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
                    tags: [{ id: 701, songId: 7, tagId: 9 }],
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

        expect(result.items).toEqual([{ id: 50, sortOrder: 10 }]);
        const dto = db3.eventSongListDetailView.parseDto(result.items[0]);
        expect(db3.hydrateEventSongListDetailDto(dto).content).toBeUndefined();
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
