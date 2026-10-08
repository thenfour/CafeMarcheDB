import { eventStatusDtoFixture, eventTypeDtoFixture } from "../support/eventCatalogFixtures";
import { fileTagReferenceFixture, groupReferenceFixture, instrumentDtoFixture, instrumentReferenceFixture, permissionReferenceFixture, songTagReferenceFixture, eventTagReferenceFixture } from "../support/catalogReferenceFixtures";
import { testBandAuthorization, testServerAuthorization } from "tests/support/serverAuthorization";
import { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { eventPublicId, segmentPublicId, segmentResponsePublicId, eventResponsePublicId } from "../support/eventResponseFixtures";
import { listPublicId, listSongPublicId, listDividerPublicId } from "../support/eventSongListFixtures";
import { songPublicId } from "../support/songFixtures";
import { userPublicId } from "../support/userFixtures";
import { filePublicId } from "../support/fileFixtures";
import { galleryPublicId } from "../support/galleryFixtures";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { authorizeAndProjectDB3ViewModel } from "@db3/server/db3PublicIds";
import {
    authorizeAndHydrateViewModel,
    authorizeAndProjectViewDto,
    queryTable,
    queryView,
    queryHydratedView,
} from "@db3/server/db3QueryCore";
import { validateDB3QueryRequest } from "@db3/server/db3RequestValidation";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { DateTimeRange } from "shared/time";
import { Prisma } from "db";
import { z } from "zod";
import { gGeneralPaletteList } from "src/core/components/color/palette";
import { selectPrismaTestRow } from "../support/prismaSelection";
import type { DB3ReadSelectionArgs } from "@db3/shared/core/db3ReadSelection";
import { bindDB3ReadSnapshot } from "@db3/server/db3ReadExecution";


// These projection tests supply one Event delegate; native tests verify real grant refresh.
async function eventQuerySnapshot(auth: CMServerAuthorization, findMany: (args: unknown) => Promise<unknown[]>) {
    vi.spyOn(auth, "refresh").mockResolvedValue(auth);
    const database = { Event: { findMany } } as unknown as Prisma.TransactionClient; // Only this delegate is used by these projection tests.
    return bindDB3ReadSnapshot(database, auth, { isolationLevel: "Serializable" });
}
const membershipPublicId = parsePublicId<"BandUser">("FixtureMember001");

const groupPublicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");
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
const wikiPagePublicId = parsePublicId<"WikiPage">("AbCdEfGhIjKlMn23");
const wikiRevisionPublicId = parsePublicId<"WikiPageRevision">("AbCdEfGhIjKlMn24");
const group = {
    publicId: groupPublicId,
    name: "Brass",
    description: "Brass instruments",
    color: "orange",
    sortOrder: 1,
};
const hydratedGroup = groupReferenceFixture(groupPublicId);

// Scalar query/projection mechanics are independent of the localized band catalog.
const scalarSelection = Prisma.validator<Prisma.SetlistPlanGroupDefaultArgs>()({
    select: { publicId: true, name: true, description: true, color: true, sortOrder: true },
});
const scalarContract = db3.deriveViewContract(db3.xSetlistPlanGroup, scalarSelection);
const scalarListView = db3.defineView({
    viewID: "SetlistPlanGroup_TestList", entity: db3.xSetlistPlanGroup,
    selection: scalarContract.prismaSelection, dtoSchema: scalarContract.dtoSchema, hydrate: scalarContract.hydrate,
});
const scalarRow = { ...group, publicId: db3.xSetlistPlanGroup.parseIdentity(groupPublicId) };

describe("DB3 named views", () => {
    it("returns DTOs by default and hydrates only when explicitly requested", async () => {
        const row = { ...scalarRow, id: 7, bandId: 1, createdByUserId: 10 };
        const findMany = vi.fn(async () => [row]);
        // queryHydratedView accepts the full Prisma client contract; this focused test double
        // deliberately implements only the delegate exercised by this view.
        const database = { SetlistPlanGroup: { findMany } } as unknown as Parameters<typeof queryHydratedView>[3];
        const references = db3.createDashboardReferenceStore();
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
            { id: 3, name: Permission.setlist_planner_access },
        ]);

        const input = {
            view: scalarListView,
            filter: { items: [] },
            cmdbQueryContext: "dashboard-view-query-test",
            orderBy: undefined,
        };
        const authorization = testBandAuthorization(null, effectivePermissions);
        const hydrate = vi.spyOn(input.view, "hydrate");
        const dtoResult = await queryView(input, authorization, database);
        expect(dtoResult.items).toEqual([scalarRow]);
        expect(dtoResult.items[0]).not.toHaveProperty("id");
        expectTypeOf(dtoResult.items).toEqualTypeOf<db3.DtoOf<typeof input.view>[]>();
        expect(hydrate).not.toHaveBeenCalled();

        const result = await queryHydratedView(input, authorization, references, database);
        expect(hydrate).toHaveBeenCalledOnce();
        hydrate.mockRestore();

        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            select: expect.objectContaining({ publicId: true, name: true, description: true, color: true }),
        }));
        expect(result.items).toEqual([{ ...scalarRow, color: gGeneralPaletteList.findEntry("orange") }]);
        expect(result.items[0]).not.toHaveProperty("id");
        expectTypeOf(result.items).toEqualTypeOf<db3.ClientOf<typeof scalarListView>[]>();
    });

    it("reads shared attendance captions as public metadata without a band grant", () => {
        const authorization = new CMServerAuthorization(null, new ServerPermissionSet([
            { id: 1, name: Permission.always_grant }, { id: 2, name: Permission.public },
        ]));
        expect(authorization.hasPermission(Permission.view_events_nonpublic)).toBe(false);
        for (const columnName of ["buttonCaption", "personalCaption", "pastCaption", "personalPastCaption", "description", "strength", "isActive"]) {
            expect(db3.xEventAttendance.authorizeColumnForView({ auth: authorization, model: null, columnName })).toBe(true);
        }
    });

    it("derives ordinary selections from DTO schemas and preserves explicit query additions", async () => {
        const context = {
            filter: { items: [] },
            auth: testServerAuthorization(null, new ServerPermissionSet([])),
        };

        expect(db3.eventTypeEditorView.getSelectionArgs(context)).toEqual({
            select: {
                publicId: true,
                name: true, nameId: true,
                description: true, descriptionId: true,
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
                            publicId: true,
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
            descriptionStringPublicId: null,
            descriptionResolution: {
                value: "Public", localeTag: "en-US", scope: "global", source: "stored", reason: "exact", requestedTag: "en-US",
            },
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
            .toMatchTypeOf<{ publicId: string; name: { publicId: string; format: string } }>();
    });

    it("composes a root view predicate without disturbing nested Prisma where clauses", async () => {
        const selection = Prisma.validator<Prisma.EventDefaultArgs>()({
            select: {
                id: true,
                tags: {
                    select: { id: true },
                    where: { bandEventTagId: { gt: 0 } },
                },
            },
        });
        const view = db3.defineView({
            viewID: "Test_EventNestedWhere",
            entity: db3.xEvent,
            selection,
            where: ({ auth }) => ({
                createdByUserId: auth.userId,
            }),
            dtoSchema: z.object({
                id: z.number().int(),
                tags: z.array(z.object({ id: z.number().int() })).optional(),
            }),
            hydrate: dto => dto,
        });
        const findMany = vi.fn(async (_args: unknown) => []);
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
            { id: 3, name: Permission.view_events },
            { id: 4, name: Permission.visibility_public },
            { id: 5, name: Permission.login },
        ]);

        const authorization = testBandAuthorization({ id: 42 }, effectivePermissions);
        await queryTable({
            table: {
                tableID: "Event",
                tableName: "Event",
                viewID: view.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "db3-view-where-composition-test",
        }, authorization, await eventQuerySnapshot(authorization, findMany));

        const prismaArgs = findMany.mock.calls[0]![0] as any;
        expect(prismaArgs.where.AND).toEqual(expect.arrayContaining([
            { createdByUserId: 42 },
        ]));
        expect(prismaArgs.select.tags.where.AND).toEqual(expect.arrayContaining([
            { bandEventTagId: { gt: 0 } },
        ]));
        expectTypeOf(view.getWhereClause({
            filter: { items: [] },
            auth: testServerAuthorization({ id: 42 }, effectivePermissions),
        })).toEqualTypeOf<Prisma.EventWhereInput | undefined>();
    });

    it("validates view ownership as part of the query contract", () => {
        const request = validateDB3QueryRequest({
            table: {
                tableID: "SetlistPlanGroup",
                tableName: "SetlistPlanGroup",
                viewID: scalarListView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "db3-view-test",
        });
        expect(request.table.viewID).toBe(scalarListView.viewID);

        expect(() => validateDB3QueryRequest({
            table: {
                tableID: db3.xInstrument.tableID,
                tableName: db3.xInstrument.tableName,
                viewID: scalarListView.viewID,
            },
            filter: { items: [] },
            cmdbQueryContext: "db3-view-test",
        })).toThrow("does not belong to table 'BandInstrument'");

        expect(() => validateDB3QueryRequest({
            table: {
                tableID: db3.xInstrument.tableID,
                tableName: db3.xInstrument.tableName,
                viewID: "Missing_View",
            },
            filter: { items: [] },
            cmdbQueryContext: "db3-view-test",
        })).toThrow("unknown view ID 'Missing_View'");
    });

    it("parses the authorized DTO shape and never exposes a database ID", async () => {
        const findMany = vi.fn(async () => [{ id: 54, bandId: 1, createdByUserId: 100, ...scalarRow }]);
        // Only this selected delegate is exercised by the projection test.
        const database = { SetlistPlanGroup: { findMany } } as unknown as Parameters<typeof queryTable>[2];
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.setlist_planner_access },
            { id: 3, name: Permission.sysadmin },
        ]);

        const result = await queryTable({
            table: {
                tableID: "SetlistPlanGroup",
                tableName: "SetlistPlanGroup",
                viewID: scalarListView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "db3-view-test",
        }, testBandAuthorization({ id: 100 }, effectivePermissions), database);

        expect(result.items).toEqual([scalarRow]);
        expect(result.items[0]).not.toHaveProperty("id");
        expect(findMany).toHaveBeenCalledOnce();

        expect(() => scalarListView.parseDto({ publicId: "invalid" })).toThrow();
        expectTypeOf<db3.DtoOf<typeof scalarListView>["name"]>()
            .toEqualTypeOf<string | undefined>();
    });

    it("applies the same view boundary to a single row returned by a mutation", () => {
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.setlist_planner_access },
            { id: 3, name: Permission.sysadmin },
        ]);
        const dto = authorizeAndProjectViewDto(
            scalarListView,
            { id: 54, bandId: 1, createdByUserId: 100, ...scalarRow },
            testBandAuthorization({ id: 100 }, effectivePermissions),
            "db3-single-view-dto-test",
        );
        expect(dto).toEqual(scalarRow);
        expect(dto).not.toHaveProperty("id");
        expectTypeOf(dto).toEqualTypeOf<db3.DtoOf<typeof scalarListView> | null>();

        const result = authorizeAndHydrateViewModel(
            scalarListView,
            { id: 54, bandId: 1, createdByUserId: 100, ...scalarRow },
            testBandAuthorization({ id: 100 }, effectivePermissions),
            db3.createDashboardReferenceStore(),
            "db3-single-view-model-test",
        );

        expect(result).toEqual({ ...scalarRow, color: gGeneralPaletteList.findEntry("orange") });
        expect(result).not.toHaveProperty("id");
    });

    it("preserves a server-computed page order before a view removes database IDs", async () => {
        const secondPublicId = parsePublicId<"SetlistPlanGroup">("BcDeFgHiJkLmNo12");
        const findMany = vi.fn(async (args: DB3ReadSelectionArgs) => [
            { id: 1, bandId: 1, createdByUserId: 100, ...scalarRow },
            { id: 2, bandId: 1, createdByUserId: 100, ...scalarRow, publicId: secondPublicId, name: "Woodwind" },
        ].map(row => selectPrismaTestRow(row, args)));
        // Only this selected delegate is exercised by the projection test.
        const database = { SetlistPlanGroup: { findMany } } as unknown as Parameters<typeof queryTable>[2];
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.setlist_planner_access },
            { id: 3, name: Permission.sysadmin },
        ]);

        const result = await queryTable({
            table: {
                tableID: "SetlistPlanGroup",
                tableName: "SetlistPlanGroup",
                viewID: scalarListView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "db3-view-ordered-test",
        }, testBandAuthorization({ id: 100 }, effectivePermissions), database, {
            orderedPrimaryKeys: [2, 1],
        });

        expect(result.items.map(item => item.publicId)).toEqual([secondPublicId, groupPublicId]);
        expect(result.items.every(item => !("id" in item))).toBe(true);
    });

    it("queries the finite Custom Link and Menu Link collection views", async () => {
        const createdAt = new Date("2026-09-21T12:00:00.000Z");
        const createdByUser = { id: 100, publicId: userPublicId(100), name: "Ada", cssClass: null, isDeleted: false };
        const customLink = {
            id: 20,
            bandId: 1,
            publicId: "CustomLinkTest01",
            name: "Scores",
            description: "Shared scores",
            slug: "scores",
            destinationURL: "https://example.test/scores",
            redirectType: "Temporary",
            intermediateMessage: null,
            forwardQuery: true,
            fileId: null,
            file: null,
            createdAt,
            createdByUserId: createdByUser.id,
            createdByUser,
            _count: { visits: 42 },
        };
        const directFileLink = {
            ...customLink,
            id: 21,
            publicId: "CustomLinkTest02",
            slug: "MyPage",
            destinationURL: null,
            redirectType: "ServeFile",
            fileId: 8,
            file: {
                id: 8,
                bandId: 1,
                publicId: filePublicId(8),
                fileLeafName: "mypage.html",
                storedLeafName: "stored-page.html",
                description: "Page",
                isDeleted: false,
                externalURI: null,
                uploadedByUserId: null,
                visiblePermissionId: 7,
                visiblePermission: { id: 7, name: Permission.visibility_public, roles: [] },
            },
        };
        const menuLink = {
            id: 30,
            publicId: "MenuLinkTest0001",
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
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.sysadmin },
            { id: 4, name: Permission.view_custom_links },
            { id: 5, name: Permission.public },
            { id: 6, name: Permission.view_files },
            { id: 7, name: Permission.visibility_public },
        ]);
        const authorization = new CMServerAuthorization({ id: createdByUser.id } as any, effectivePermissions);
        const customLinkAuthorization = testBandAuthorization(createdByUser, effectivePermissions);
        vi.spyOn(customLinkAuthorization, "refresh").mockResolvedValue(customLinkAuthorization);
        // This projection fixture supplies only the delegate used by the read snapshot.
        const customLinkDatabase = { CustomLink: { findMany: vi.fn(async () => [customLink, directFileLink]) } } as unknown as Prisma.TransactionClient;
        const customLinkSnapshot = await bindDB3ReadSnapshot(customLinkDatabase, customLinkAuthorization, { isolationLevel: "Serializable" });

        const customResult = await queryTable({
            table: {
                tableID: db3.xCustomLink.tableID,
                tableName: db3.xCustomLink.tableName,
                viewID: db3.customLinkListView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "custom-link-list-view-test",
        }, customLinkAuthorization, customLinkSnapshot);
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

        const createdByUserDto = { publicId: createdByUser.publicId, name: createdByUser.name, cssClass: createdByUser.cssClass };
        expect(customResult.items).toEqual([
            expect.objectContaining({ publicId: customLink.publicId, createdByUserId: createdByUser.publicId, createdByUser: createdByUserDto }),
            expect.objectContaining({
                publicId: directFileLink.publicId,
                fileId: filePublicId(8),
                file: expect.objectContaining({ publicId: filePublicId(8), fileLeafName: "mypage.html" }),
            }),
        ]);
        expect(menuResult.items).toEqual([expect.objectContaining({ publicId: menuLink.publicId, createdByUserId: createdByUser.publicId, createdByUser: createdByUserDto })]);
        expect(customResult.items[0]).not.toHaveProperty("id");
        expect(menuResult.items[0]).not.toHaveProperty("id");
    });

    it("represents authorization-stripped fields as absent optional DTO members", () => {
        const publicData = testBandAuthorization(null, new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
        ]));
        const authorized = authorizeAndProjectDB3ViewModel(db3.xEvent, {
            id: 8, bandId: 1,
            publicId: eventPublicId(8),
            name: "Public concert",
            startsAt: null,
            type: null,
            createdByUserId: 100,
            visiblePermissionId: 2,
            isDeleted: false,
        }, publicData, "db3-view-field-authorization");

        expect(authorized).toMatchObject({ publicId: eventPublicId(8), name: "Public concert" });
        expect(authorized).not.toHaveProperty("id");
        expect(authorized).not.toHaveProperty("isDeleted");
    });

    it("projects the finite WikiPage tag editor view", async () => {
        const findMany = vi.fn(async () => [{
            id: 15,
            publicId: wikiPagePublicId,
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
        const effectivePermissions = new ServerPermissionSet([
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
            filter: { publicIds: [wikiPagePublicId] },
            cmdbQueryContext: "wiki-page-editor-view-test",
        }, new CMServerAuthorization({ id: 100 } as any, effectivePermissions), {
            WikiPage: { findMany },
        } as any);

        expect(result.items).toEqual([{
            publicId: wikiPagePublicId,
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
        });

        const dto = instrumentDtoFixture(instrumentPublicId, groupPublicId);
        const hydrated = db3.hydrateView(db3.instrumentDashboardView, dto, references);

        expect(hydrated.functionalGroup).toEqual(
            references.require(db3.xInstrumentFunctionalGroup, group.publicId, "test"),
        );
        expectTypeOf(hydrated).toEqualTypeOf<db3.InstrumentDashboardClient>();
        expectTypeOf<db3.DbPayloadOf<typeof db3.instrumentDashboardView>>()
            .toMatchTypeOf<{
                publicId: string;
                functionalGroupId: number;
            }>();
    });

    it("hydrates the Song search view recursively and keeps authorized fields optional", () => {
        const references = db3.createDashboardReferenceStore();
        const permission = permissionReferenceFixture(permissionPublicId);
        const songTag = songTagReferenceFixture(songTagPublicId);
        const fileTag = fileTagReferenceFixture(fileTagPublicId);
        db3.registerDashboardReferences(references, {
            permission: [permission],
            songTag: [songTag],
            fileTag: [fileTag],
        });

        const dto = db3.songSearchView.parseDto({
            publicId: songPublicId(7),
            name: "A song",
            aliases: "",
            startBPM: null,
            endBPM: null,
            introducedYear: null,
            lengthSeconds: null,
            visiblePermissionId: permission.publicId,
            tags: [{ publicId: songTagAssociationPublicId, bandSongTagId: songTag.publicId }],
            taggedFiles: [{
                publicId: fileSongTagPublicId,
                fileId: 8,
                songId: songPublicId(7),
                file: {
                    publicId: filePublicId(8),
                    tags: [{ publicId: fileTagAssignmentPublicId, bandFileTagId: fileTag.publicId }],
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
        expect(hydrated.taggedFiles?.[0]?.file?.tags?.[0]?.bandFileTag).toEqual(
            references.require(db3.xBandFileTag, fileTag.publicId, "test"),
        );
        expectTypeOf(dto.aliases).toEqualTypeOf<string>();
        expectTypeOf(hydrated).toEqualTypeOf<db3.SongSearchClient>();
    });

    it("hydrates the File search view with normalized reference relations", () => {
        const references = db3.createDashboardReferenceStore();
        const permission = permissionReferenceFixture(permissionPublicId);
        const fileTag = fileTagReferenceFixture(fileTagPublicId);
        const instrument = instrumentReferenceFixture(instrumentPublicId, hydratedGroup);
        db3.registerDashboardReferences(references, {
            permission: [permission],
            fileTag: [fileTag],
            instrumentFunctionalGroup: [hydratedGroup],
            instrument: [instrument],
            eventStatus: [db3.eventStatusDashboardView.hydrate(eventStatusDtoFixture(eventStatusPublicId, "Confirmed"), db3.createDashboardReferenceStore())],
            eventType: [db3.eventTypeDashboardView.hydrate(eventTypeDtoFixture(eventTypePublicId, "Concert"), db3.createDashboardReferenceStore())],
        });

        const dto = db3.fileSearchView.parseDto({
            publicId: filePublicId(8),
            fileLeafName: "score.pdf",
            description: "",
            externalURI: null,
            visiblePermissionId: permission.publicId,
            tags: [{ publicId: fileTagAssignmentPublicId, bandFileTagId: fileTag.publicId }],
            taggedSongs: [{ publicId: fileSongTagPublicId, song: { publicId: songPublicId(7), name: "A song" } }],
            taggedEvents: [
                {
                    publicId: fileEventTagPublicId,
                    event: {
                        publicId: eventPublicId(9),
                        name: "A concert",
                        startsAt: new Date("2026-06-01T19:00:00Z"),
                        statusId: eventStatusPublicId,
                        typeId: eventTypePublicId,
                    },
                },
            ],
            taggedInstruments: [{ publicId: fileInstrumentTagPublicId, bandInstrumentId: instrument.publicId }],
            taggedWikiPages: [{ publicId: fileWikiPageTagPublicId, wikiPage: { id: 12, publicId: wikiPagePublicId, slug: "repertoire" } }],
        });
        const hydrated = db3.hydrateView(db3.fileSearchView, dto, references);

        expect(hydrated.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(hydrated.tags).toHaveLength(1);
        expect(hydrated.tags?.[0]?.bandFileTag).toEqual(
            references.require(db3.xBandFileTag, fileTag.publicId, "test"),
        );
        expect(hydrated.taggedSongs).toHaveLength(1);
        expect(hydrated.taggedSongs?.[0]?.song.name).toBe("A song");
        expect(hydrated.taggedEvents).toHaveLength(1);
        expect(hydrated.taggedEvents?.[0]?.event.name).toBe("A concert");
        expect(hydrated.taggedInstruments).toHaveLength(1);
        expect(hydrated.taggedInstruments?.[0]?.bandInstrument).toEqual(
            references.require(db3.xInstrument, instrument.publicId, "test"),
        );
        expect(hydrated.taggedWikiPages).toHaveLength(1);
        expect(hydrated.taggedWikiPages?.[0]?.wikiPage.slug).toBe("repertoire");
        expectTypeOf(dto.description).toEqualTypeOf<string>();
        expectTypeOf(hydrated).toEqualTypeOf<db3.FileSearchClient>();
    });

    it("hydrates the File detail view with its relationship panels", () => {
        const references = db3.createDashboardReferenceStore();
        const permission = permissionReferenceFixture(permissionPublicId);
        const fileTag = fileTagReferenceFixture(fileTagPublicId);
        const instrument = instrumentReferenceFixture(instrumentPublicId, hydratedGroup);
        db3.registerDashboardReferences(references, {
            permission: [permission],
            fileTag: [fileTag],
            instrumentFunctionalGroup: [hydratedGroup],
            instrument: [instrument],
            eventType: [db3.eventTypeDashboardView.hydrate(eventTypeDtoFixture(eventTypePublicId, "Concert"), db3.createDashboardReferenceStore())],
        });

        const selection = db3.fileDetailView.getSelectionArgs({
            filter: { items: [] },
            auth: testServerAuthorization(null, new ServerPermissionSet([])),
        });
        expect(selection).toMatchObject({
            select: {
                customData: true,
                isDeleted: true,
                frontpageGalleryItems: { select: { publicId: true } },
                parentFile: { select: { publicId: true, fileLeafName: true } },
                childFiles: { select: { publicId: true, fileLeafName: true } },
                previewFile: { select: { publicId: true, fileLeafName: true } },
                previewForFile: { select: { publicId: true, fileLeafName: true } },
                pinnedForSongs: { select: { publicId: true, name: true } },
            },
        });

        const dto = db3.fileDetailView.parseDto({
            publicId: filePublicId(8),
            fileLeafName: "score.pdf",
            description: "",
            customData: "{\"width\":1200}",
            externalURI: null,
            fileCreatedAt: null,
            parentFileId: null,
            previewFileId: null,
            isDeleted: true,
            visiblePermissionId: permission.publicId,
            tags: [{ publicId: fileTagAssignmentPublicId, bandFileTagId: fileTag.publicId }],
            taggedUsers: [{ publicId: fileUserTagPublicId, bandUser: { publicId: membershipPublicId, user: { publicId: userPublicId(13), name: "Ada" } } }],
            taggedSongs: [{ publicId: fileSongTagPublicId, song: { publicId: songPublicId(14), name: "A song" } }],
            taggedEvents: [{
                publicId: fileEventTagPublicId,
                event: {
                    publicId: eventPublicId(15),
                    name: "A concert",
                    startsAt: null,
                    statusId: null,
                    typeId: eventTypePublicId,
                },
            }],
            taggedInstruments: [{ publicId: fileInstrumentTagPublicId, bandInstrumentId: instrument.publicId }],
            taggedWikiPages: [{ publicId: fileWikiPageTagPublicId, wikiPage: { id: 16, publicId: wikiPagePublicId, slug: "repertoire" } }],
            frontpageGalleryItems: [{ publicId: galleryPublicId(90) }],
            parentFile: { publicId: filePublicId(7), fileLeafName: "source.pdf" },
            childFiles: [{ publicId: filePublicId(9), fileLeafName: "part.pdf" }],
            previewFile: { publicId: filePublicId(10), fileLeafName: "preview.png" },
            previewForFile: [{ publicId: filePublicId(11), fileLeafName: "poster.pdf" }],
            pinnedForSongs: [{ publicId: songPublicId(12), name: "A song" }],
        });
        const hydrated = db3.hydrateView(db3.fileDetailView, dto, references);

        expect(hydrated.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(dto).not.toHaveProperty("isDeleted");
        expect(hydrated.tags?.[0]?.bandFileTag).toEqual(
            references.require(db3.xBandFileTag, fileTag.publicId, "test"),
        );
        expect(hydrated.taggedUsers).toEqual([{ publicId: fileUserTagPublicId, bandUser: { publicId: membershipPublicId, user: { publicId: userPublicId(13), name: "Ada" } } }]);
        expect(hydrated.taggedSongs).toEqual([{ publicId: fileSongTagPublicId, song: { publicId: songPublicId(14), name: "A song" } }]);
        expect(hydrated.taggedEvents?.[0]?.event.name).toBe("A concert");
        expect(hydrated.taggedInstruments?.[0]?.bandInstrument).toEqual(
            references.require(db3.xInstrument, instrument.publicId, "test"),
        );
        expect(hydrated.taggedWikiPages).toEqual([{
            publicId: fileWikiPageTagPublicId,
            wikiPage: { publicId: wikiPagePublicId, slug: "repertoire" },
        }]);
        expect(hydrated.frontpageGalleryItems).toEqual([{ publicId: galleryPublicId(90) }]);
        expect(hydrated.parentFile).toEqual({ publicId: filePublicId(7), fileLeafName: "source.pdf" });
        expect(hydrated.childFiles).toEqual([{ publicId: filePublicId(9), fileLeafName: "part.pdf" }]);
        expect(hydrated.previewFile).toEqual({ publicId: filePublicId(10), fileLeafName: "preview.png" });
        expect(hydrated.previewForFile).toEqual([{ publicId: filePublicId(11), fileLeafName: "poster.pdf" }]);
        expect(hydrated.pinnedForSongs).toEqual([{ publicId: songPublicId(12), name: "A song" }]);
        expectTypeOf(hydrated).toEqualTypeOf<db3.FileDetailClient>();
    });

    it("builds Event search selections from the authenticated actor, never client identity", () => {
        const authorization = testBandAuthorization({ id: 42 }, new ServerPermissionSet([]));
        const selection = db3.eventSearchView.getSelectionArgs({
            filter: { items: [] },
            auth: authorization,
        });

        expect(selection.select.responses.where).toEqual({ bandUserId: 1 });
        expect(selection.select.segments.select.responses.where).toEqual({ bandUserId: 1 });
        expect(selection.select.expectedAttendanceUserTag.select.bandUserTagAssignments.where)
            .toEqual({ bandUserId: 1 });
    });

    it("hydrates Event search data into one typed client shape and preserves omitted collections", () => {
        const references = db3.createDashboardReferenceStore();
        const eventType = db3.eventTypeDashboardView.hydrate(eventTypeDtoFixture(eventTypePublicId), references);
        const eventStatus = db3.eventStatusDashboardView.hydrate(eventStatusDtoFixture(eventStatusPublicId), references);
        const eventTag = eventTagReferenceFixture(eventTagPublicId);
        db3.registerDashboardReferences(references, {
            eventType: [eventType],
            eventStatus: [eventStatus],
            eventTag: [eventTag],
        });

        const dto = db3.eventSearchView.parseDto({
            publicId: eventPublicId(1),
            name: "Actor-scoped event",
            locationDescription: "",
            locationURL: "",
            startsAt: null,
            durationMillis: BigInt(3_600_000),
            isAllDay: false,
            typeId: eventType.publicId,
            statusId: eventStatus.publicId,
            tags: [{ publicId: eventTagAssignmentPublicId, bandEventTagId: eventTag.publicId }],
            responses: [{ publicId: eventResponsePublicId(11), bandUserId: membershipPublicId, bandInstrumentId: null, isInvited: true, userComment: null }],
            expectedAttendanceUserTag: {
                publicId: userTagPublicId,
                bandUserTagAssignments: [{ bandUserId: membershipPublicId }],
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
            references.require(db3.xBandEventTag, eventTag.publicId, "test"),
        );
        expect(hydrated.expectedAttendanceUserTag?.bandUserTagAssignments?.[0]?.bandUserId).toBe(membershipPublicId);
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
            publicId: eventPublicId(1),
            name: "Timed event",
            locationDescription: "",
            locationURL: "",
            startsAt: null,
            durationMillis: BigInt(86_400_000),
            isAllDay: true,
            tags: [],
            segments: [
                {
                    publicId: segmentPublicId(2),
                    startsAt: segmentStart,
                    durationMillis: BigInt(3_600_000),
                    isAllDay: false,
                },
                {
                    publicId: segmentPublicId(3),
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
            id: 1, bandId: 1,
            publicId: eventPublicId(1),
            revision: 1,
            name: "Actor-scoped event",
            typeId: null,
            locationDescription: "",
            locationURL: "",
            statusId: null,
            relevanceClassOverride: null,
            descriptionWikiPageId: null,
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
                bandEventTagId: 4,
                eventTag: { id: 4, publicId: eventTagPublicId, bandId: 1 },
            }],
            responses: [{ id: 11, publicId: eventResponsePublicId(11), bandUserId: 1, bandUser: { id: 1, publicId: membershipPublicId, bandId: 1, userId: 42 }, bandInstrumentId: null, isInvited: true, userComment: null }],
            segments: [{
                id: 20, publicId: segmentPublicId(20), eventId: 1,
                event: { publicId: eventPublicId(1), bandId: 1, createdByUserId: 42, visiblePermissionId: null, isDeleted: false },
                name: "Main",
                startsAt,
                durationMillis: BigInt(3_600_000),
                isAllDay: false,
                statusId: null,
                responses: [{ id: 21, publicId: segmentResponsePublicId(21), bandUserId: 1, bandUser: { id: 1, publicId: membershipPublicId, bandId: 1, userId: 42 }, attendanceId: null }],
            }],
            songLists: [],
            expectedAttendanceUserTag: {
                id: 5, bandId: 1,
                publicId: userTagPublicId,
                bandUserTagAssignments: [{
                    id: 22, bandUserId: 1, bandUser: { id: 1, publicId: membershipPublicId, bandId: 1, userId: 42, isDeleted: false },
                    bandUserTagId: 5, bandUserTag: { publicId: userTagPublicId, bandId: 1 }
                }],
            },
            descriptionWikiPage: {
                id: 30,
                publicId: wikiPagePublicId,
                createdByUserId: 42,
                visiblePermissionId: null,
                currentRevision: {
                    id: 31,
                    publicId: wikiRevisionPublicId,
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
        const effectivePermissions = new ServerPermissionSet(permissionNames.map((name, index) => ({
            id: index + 1,
            name,
        })));

        const authorization = testBandAuthorization({ id: 42 }, effectivePermissions);
        const result = await queryTable({
            table: {
                tableID: db3.xEvent.tableID,
                tableName: db3.xEvent.tableName,
                viewID: db3.eventSearchView.viewID,
            },
            orderBy: undefined,
            filter: { items: [] },
            cmdbQueryContext: "event-search-view-test",
        }, authorization, await eventQuerySnapshot(authorization, findMany));

        expect(result.items).toEqual([expect.objectContaining({
            publicId: eventPublicId(1),
            responses: [expect.objectContaining({ bandUserId: membershipPublicId })],
            segments: [expect.objectContaining({
                responses: [expect.objectContaining({ bandUserId: membershipPublicId })],
            })],
            expectedAttendanceUserTag: expect.objectContaining({
                bandUserTagAssignments: [expect.objectContaining({ bandUserId: membershipPublicId })],
            }),
            descriptionWikiPage: {
                publicId: wikiPagePublicId,
                currentRevision: { publicId: wikiRevisionPublicId, content: "Event details" },
            },
        })]);
        expect(result.items[0]).not.toHaveProperty("createdByUserId");
        expect(result.items[0]).not.toHaveProperty("isDeleted");
        expect(result.items[0]!.descriptionWikiPage).not.toHaveProperty("createdByUserId");
        expect(result.items[0]!.descriptionWikiPage).not.toHaveProperty("visiblePermissionId");

        const queryArgs = findMany.mock.calls[0]![0] as any;
        expect(queryArgs.select.responses.where.AND[0]).toEqual({ bandUserId: 1 });
        expect(queryArgs.select.segments.select.responses.where.AND[0]).toEqual({ bandUserId: 1 });
        expect(queryArgs.select.expectedAttendanceUserTag.select.bandUserTagAssignments.where.AND[0])
            .toEqual({ bandUserId: 1 });
    });

    it("queries Wiki Event context through the named view and projects classification identities", async () => {
        const startsAt = new Date("2026-09-20T18:00:00Z");
        const findMany = vi.fn(async () => [{
            id: 17, bandId: 1,
            publicId: eventPublicId(17),
            name: "Wiki-linked event",
            createdByUserId: 42,
            visiblePermissionId: null,
            isDeleted: false,
            typeId: 101,
            type: { publicId: eventTypePublicId, isDeleted: false },
            statusId: 102,
            status: { publicId: eventStatusPublicId, isDeleted: false },
            uid: "event-uid",
            startsAt,
            endDateTime: new Date("2026-09-20T19:00:00Z"),
            isAllDay: false,
            durationMillis: BigInt(3_600_000),
            segments: [{
                publicId: segmentPublicId(18),
                event: { bandId: 1, createdByUserId: 42, visiblePermissionId: null, isDeleted: false },
                name: "Main set",
                statusId: 103,
                status: { publicId: eventStatusPublicId, isDeleted: false },
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
        const effectivePermissions = new ServerPermissionSet(permissionNames.map((name, index) => ({
            id: index + 1,
            name,
        })));

        const authorization = testBandAuthorization({ id: 42 }, effectivePermissions);
        const result = await queryView({
            view: db3.eventWikiPageContextView,
            filter: { items: [], tableParams: { eventId: eventPublicId(17) } },
            orderBy: undefined,
            take: 1,
            cmdbQueryContext: "wiki-event-context-view-test",
        }, authorization, await eventQuerySnapshot(authorization, findMany));

        expect(result.items).toEqual([{
            publicId: eventPublicId(17),
            name: "Wiki-linked event",
            typeId: eventTypePublicId,
            statusId: eventStatusPublicId,
            uid: "event-uid",
            startsAt,
            endDateTime: new Date("2026-09-20T19:00:00Z"),
            isAllDay: false,
            durationMillis: BigInt(3_600_000),
            segments: [{
                publicId: segmentPublicId(18),
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
                type: { select: { publicId: true, isDeleted: true } },
                status: { select: { publicId: true, isDeleted: true } },
            }),
        }));
        expectTypeOf(result.items).toEqualTypeOf<db3.EventWikiPageContextDto[]>();
    });

    it("projects the Song search DTO through nested field authorization", async () => {
        const rows = [{
            id: 7,
            publicId: songPublicId(7),
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
                song: { publicId: songPublicId(7), createdByUserId: 100, visiblePermissionId: null, isDeleted: false },
                bandSongTagId: 20,
                tag: { publicId: songTagPublicId, bandId: 1 },
            }],
            taggedFiles: [{
                id: 80,
                publicId: fileSongTagPublicId,
                fileId: 8,
                songId: 7,
                file: {
                    id: 8,
                    publicId: filePublicId(8),
                    uploadedByUserId: 100,
                    visiblePermissionId: null,
                    isDeleted: false,
                    tags: [{
                        id: 90,
                        publicId: fileTagAssignmentPublicId,
                        bandFileTagId: 30,
                        bandFileTag: { publicId: fileTagPublicId, bandId: 1 },
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
                user: { id: 100, publicId: userPublicId(100), name: "Composer", isDeleted: false },
            }],
        }];
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
            { id: 3, name: Permission.login },
            { id: 4, name: Permission.visibility_members },
            { id: 5, name: Permission.view_songs },
            { id: 6, name: Permission.view_files },
        ]);

        const authorization = testBandAuthorization({ id: 100 }, effectivePermissions);
        const projected = rows.map(row => authorizeAndProjectDB3ViewModel(
            db3.songSearchView.entity, row, authorization, "nested view projection",
        )).filter(row => row !== null);
        const result = { items: projected.map(row => db3.songSearchView.parseDto(row)) };

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({
            publicId: songPublicId(7),
            tags: [{
                publicId: songTagAssociationPublicId,
                bandSongTagId: songTagPublicId,
            }],
            taggedFiles: [{
                publicId: fileSongTagPublicId,
                file: {
                    publicId: filePublicId(8),
                    tags: [{
                        publicId: fileTagAssignmentPublicId,
                        bandFileTagId: fileTagPublicId,
                    }],
                },
            }],
            credits: [{
                publicId: songCreditPublicId,
                typeId: songCreditTypePublicId,
                user: { publicId: userPublicId(100), name: "Composer" },
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
        const permission = permissionReferenceFixture(permissionPublicId);
        const songTag = songTagReferenceFixture(songTagPublicId);
        const fileTag = fileTagReferenceFixture(fileTagPublicId);
        const instrument = instrumentReferenceFixture(instrumentPublicId, hydratedGroup);
        db3.registerDashboardReferences(references, {
            permission: [permission],
            songTag: [songTag],
            fileTag: [fileTag],
            instrumentFunctionalGroup: [hydratedGroup],
            instrument: [instrument],
        });

        const dto = db3.songDetailView.parseDto({
            publicId: songPublicId(7),
            createdByUser: { publicId: userPublicId(100) },
            name: "A song",
            aliases: "",
            description: "Detail description",
            startBPM: null,
            endBPM: null,
            introducedYear: null,
            lengthSeconds: null,
            visiblePermissionId: permission.publicId,
            pinnedRecordingId: null,
            tags: [{ publicId: songTagAssociationPublicId, bandSongTagId: songTag.publicId }],
            taggedFiles: [{
                publicId: fileSongTagPublicId,
                fileId: filePublicId(8),
                file: {
                    publicId: filePublicId(8),
                    fileLeafName: "score.pdf",
                    description: "",
                    externalURI: null,
                    fileCreatedAt: null,
                    parentFileId: null,
                    previewFileId: null,
                    visiblePermissionId: permission.publicId,
                    tags: [{ publicId: fileTagAssignmentPublicId, bandFileTagId: fileTag.publicId }],
                    taggedUsers: [],
                    taggedSongs: [],
                    taggedEvents: [],
                    taggedInstruments: [{ publicId: fileInstrumentTagPublicId, bandInstrumentId: instrument.publicId }],
                    taggedWikiPages: [],
                },
            }],
            credits: [],
        });
        const hydrated = db3.hydrateView(db3.songDetailView, dto, references);
        expect(dto).not.toHaveProperty("createdByUserId");
        expect(hydrated.createdByUser?.publicId).toBe(userPublicId(100));

        expect(hydrated.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(hydrated.tags?.[0]?.tag).toEqual(
            references.require(db3.xSongTag, songTag.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file.visiblePermission).toEqual(
            references.require(db3.xPermission, permission.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file.tags?.[0]?.bandFileTag).toEqual(
            references.require(db3.xBandFileTag, fileTag.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file.taggedInstruments?.[0]?.bandInstrument).toEqual(
            references.require(db3.xInstrument, instrument.publicId, "test"),
        );
        expect(hydrated.taggedFiles?.[0]?.file.taggedEvents).toEqual([]);
        expect(hydrated.credits).toEqual([]);
        expectTypeOf(dto.aliases).toEqualTypeOf<string>();
        expectTypeOf(hydrated).toEqualTypeOf<db3.SongDetailClient>();
    });

    it("projects the Song detail DTO recursively without leaking authorization support fields", async () => {
        const uploadedAt = new Date("2026-01-02T12:00:00Z");
        const rows = [{
            id: 7,
            publicId: songPublicId(7),
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
                song: { publicId: songPublicId(7), createdByUserId: 100, visiblePermissionId: 3, isDeleted: false },
                bandSongTagId: 20,
                tag: { publicId: songTagPublicId, bandId: 1 },
            }],
            taggedFiles: [{
                id: 80,
                publicId: fileSongTagPublicId,
                fileId: 8,
                songId: 7,
                file: {
                    id: 8,
                    publicId: filePublicId(8),
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
                        bandFileTagId: 30,
                        bandFileTag: { publicId: fileTagPublicId, bandId: 1 },
                    }],
                    taggedUsers: [],
                    taggedSongs: [{
                        id: 91,
                        publicId: fileSongTagPublicId,
                        songId: 9,
                        song: {
                            id: 9,
                            publicId: songPublicId(9),
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
        }];
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.login },
            { id: 3, name: Permission.visibility_members },
            { id: 4, name: Permission.view_songs },
            { id: 5, name: Permission.view_files },
            { id: 6, name: Permission.public },
        ]);

        const authorization = testBandAuthorization({ id: 100 }, effectivePermissions);
        const projected = rows.map(row => authorizeAndProjectDB3ViewModel(
            db3.songDetailView.entity, row, authorization, "nested view projection",
        )).filter(row => row !== null);
        const result = { items: projected.map(row => db3.songDetailView.parseDto(row)) };

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({
            publicId: songPublicId(7),
            name: "A song",
            tags: [{
                publicId: songTagAssociationPublicId,
                bandSongTagId: songTagPublicId,
            }],
            taggedFiles: [{
                publicId: fileSongTagPublicId,
                file: {
                    publicId: filePublicId(8),
                    fileLeafName: "score.pdf",
                    tags: [{
                        publicId: fileTagAssignmentPublicId,
                        bandFileTagId: fileTagPublicId,
                    }],
                    taggedSongs: [{
                        publicId: fileSongTagPublicId,
                        song: { publicId: songPublicId(9), name: "Private related song" },
                    }],
                },
            }],
        });
        expect(result.items[0]).not.toHaveProperty("isDeleted");
        expect(result.items[0]?.taggedFiles?.[0]).not.toHaveProperty("fileId");
        expect(result.items[0]?.taggedFiles?.[0]?.file).not.toHaveProperty("isDeleted");
        expect(result.items[0]?.taggedFiles?.[0]?.file?.taggedSongs?.[0]?.song)
            .not.toHaveProperty("createdByUserId");
    });

    it("hydrates EventSongList persistence collections into one client value object", () => {
        const dto = db3.eventSongListDetailView.parseDto({
            publicId: listPublicId(50),
            name: "Concert set",
            description: "Main set",
            eventId: eventPublicId(5),
            sortOrder: 10,
            isOrdered: true,
            isActuallyPlayed: false,
            songs: [{
                publicId: listSongPublicId(501),
                eventSongListId: listPublicId(50),
                subtitle: "Open quietly",
                sortOrder: 20,
                songId: songPublicId(7),
                song: {
                    publicId: songPublicId(7),
                    name: "First song",
                    lengthSeconds: 120,
                    startBPM: 110,
                    endBPM: 120,
                    pinnedRecordingId: null,
                    tags: [{
                        publicId: songTagAssociationPublicId,
                        songId: songPublicId(7),
                        bandSongTagId: songTagPublicId,
                    }],
                },
            }, {
                publicId: listSongPublicId(502),
                eventSongListId: listPublicId(50),
                subtitle: null,
                sortOrder: 40,
                songId: songPublicId(8),
                song: {
                    publicId: songPublicId(8),
                    name: "Second song",
                    lengthSeconds: null,
                    startBPM: 140,
                    endBPM: null,
                    pinnedRecordingId: null,
                    tags: [],
                },
            }],
            dividers: [{
                publicId: listDividerPublicId(601),
                eventSongListId: listPublicId(50),
                subtitle: "Break",
                sortOrder: 10,
                color: null,
                isInterruption: true,
                isSong: false,
                subtitleIfSong: null,
                lengthSeconds: null,
                textStyle: null,
            }, {
                publicId: listDividerPublicId(602),
                eventSongListId: listPublicId(50),
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

    it("adapts a hydrated EventSongList to ordered editor state and a strict public-ID command", () => {
        const client = db3.hydrateEventSongListDetailDto(
            db3.eventSongListDetailView.parseDto({
                publicId: listPublicId(50),
                name: "Concert set",
                description: "Main set",
                eventId: eventPublicId(5),
                sortOrder: 10,
                isOrdered: true,
                isActuallyPlayed: false,
                songs: [{
                    publicId: listSongPublicId(501),
                    eventSongListId: listPublicId(50),
                    subtitle: "Open quietly",
                    sortOrder: 20,
                    songId: songPublicId(7),
                    song: {
                        publicId: songPublicId(7),
                        name: "First song",
                        lengthSeconds: 120,
                        startBPM: 110,
                        endBPM: 120,
                        pinnedRecordingId: null,
                        tags: [],
                    },
                }],
                dividers: [{
                    publicId: listDividerPublicId(601),
                    eventSongListId: listPublicId(50),
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
            publicId: listPublicId(50),
            eventId: eventPublicId(5),
            songs: [{ publicId: listSongPublicId(501), songId: songPublicId(7), sortOrder: 0, subtitle: "Open quietly" }],
            dividers: [{ publicId: listDividerPublicId(601), sortOrder: 1, subtitle: "Break" }],
        });
        expect(db3.eventSongListDraftToPreview(draft!).content?.items.map(item => item.type))
            .toEqual(["song", "divider"]);
        const portable = db3.eventSongListContentToPortable(client.content!);
        for (const item of portable) {
            expect(item).not.toHaveProperty("publicId");
            expect(item).not.toHaveProperty("clientId");
            expect(item).not.toHaveProperty("eventSongListId");
        }
        const firstPaste = db3.portableSongListToDraftItems(portable);
        const secondPaste = db3.portableSongListToDraftItems(portable);
        expect(new Set([...firstPaste, ...secondPaste].map(item => item.clientId)).size).toBe(4);
        expect(firstPaste.every(item => item.publicId === undefined)).toBe(true);
        const copiedDraft = db3.createEventSongListDraft({ eventId: eventPublicId(5), name: "Copy", clientId: db3.createDraftSetlistId() });
        copiedDraft.items = firstPaste;
        const copyCommand = db3.saveEventSongListCommand.serialize(copiedDraft);
        expect(copyCommand).not.toHaveProperty("publicId");
        expect(copyCommand.songs[0]).not.toHaveProperty("publicId");
        expect(copyCommand.dividers[0]).not.toHaveProperty("publicId");
        const preview = db3.eventSongListDraftToPreview(copiedDraft);
        expect(preview.clientId).toBe(copiedDraft.clientId);
        expect(preview.content?.items.map(item => item.type)).toEqual(["divider", "song"]);
        expect(preview.publicId).toBeUndefined();
        expectTypeOf(preview.clientId).toEqualTypeOf<db3.SetlistClientId>();
        expectTypeOf<string>().not.toMatchTypeOf<db3.SetlistClientId>();
        expectTypeOf<db3.DraftSetlistId>().not.toMatchTypeOf<typeof client.publicId>();
        expectTypeOf<typeof client.publicId>().toMatchTypeOf<db3.SetlistClientId>();
        expectTypeOf<db3.DraftSetlistId>().toMatchTypeOf<db3.SetlistClientId>();
        expectTypeOf(draft).toEqualTypeOf<db3.EventSongListDraft | undefined>();
    });

    it("replaces an edited setlist row without moving it", () => {
        const draft = db3.createEventSongListDraft({
            clientId: db3.createDraftSetlistId(),
            eventId: eventPublicId(5),
            name: "New set",
        });
        draft.items = [{
            type: "divider",
            clientId: "draft:10",
            color: null,
            isInterruption: false,
            isSong: false,
            subtitleIfSong: null,
            lengthSeconds: null,
            textStyle: null,
            subtitle: "First",
        }, {
            type: "divider",
            clientId: "draft:11",
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
        const editedRows = db3.replaceEventSongListEditorRow(rows, firstRow.clientId, {
            ...firstRow,
            subtitle: "Edited first",
        });

        expect(editedRows.map(row => row.clientId)).toEqual(["draft:10", "draft:11"]);
        expect(editedRows.map(row => row.type === "divider" ? row.subtitle : null))
            .toEqual(["Edited first", "Second"]);
        expect(rows[0]).toBe(firstRow);
    });

    it("does not create an editable EventSongList draft from an authorization-incomplete client", () => {
        const incomplete = db3.hydrateEventSongListDetailDto(
            db3.eventSongListDetailView.parseDto({ publicId: listPublicId(50), songs: [], dividers: [] }),
        );
        const newDraft = db3.createEventSongListDraft({
            clientId: db3.createDraftSetlistId(),
            eventId: eventPublicId(5),
            name: "New set",
        });

        expect(db3.eventSongListClientToDraft(incomplete)).toBeUndefined();
        expect(db3.saveEventSongListCommand.serialize(newDraft)).toEqual({
            eventId: eventPublicId(5),
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
            db3.eventSongListDetailView.parseDto({ publicId: listPublicId(50), songs: [] }),
        );
        const incompleteSong = db3.hydrateEventSongListDetailDto(
            db3.eventSongListDetailView.parseDto({
                publicId: listPublicId(50),
                songs: [{
                    publicId: listSongPublicId(501),
                    eventSongListId: listPublicId(50),
                    subtitle: null,
                    sortOrder: 10,
                    songId: songPublicId(7),
                }],
                dividers: [],
            }),
        );

        expect(missingCollection.content).toBeUndefined();
        expect(incompleteSong.content).toBeUndefined();
    });

    it("projects the EventSongList detail graph with recursive authorization and declares its relation ordering", async () => {
        const rows = [{
            publicId: listPublicId(50),
            name: "Concert set",
            description: "Main set",
            eventId: 5,
            event: { bandId: 1, publicId: eventPublicId(5), createdByUserId: 42, visiblePermissionId: null, isDeleted: false },
            sortOrder: 10,
            isOrdered: true,
            isActuallyPlayed: false,
            songs: [{
                publicId: listSongPublicId(501),
                eventSongListId: 50,
                eventSongList: { publicId: listPublicId(50) },
                subtitle: null,
                sortOrder: 10,
                songId: 7,
                song: {
                    id: 7,
                    publicId: songPublicId(7),
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
                        song: { publicId: songPublicId(7), createdByUserId: 42, visiblePermissionId: null, isDeleted: false },
                        bandSongTagId: 9,
                        tag: { publicId: songTagPublicId, bandId: 1 },
                    }],
                },
            }],
            dividers: [],
        }];
        const permissionNames = [
            Permission.always_grant,
            Permission.public,
            Permission.login,
            Permission.view_events_nonpublic,
            Permission.view_songs,
        ];
        const effectivePermissions = new ServerPermissionSet(permissionNames.map((name, index) => ({
            id: index + 1,
            name,
        })));

        const authorization = testBandAuthorization({ id: 42 }, effectivePermissions);
        const projected = rows.map(row => authorizeAndProjectDB3ViewModel(
            db3.eventSongListDetailView.entity, row, authorization, "nested view projection",
        )).filter(row => row !== null);
        const result = { items: projected.map(row => db3.eventSongListDetailView.parseDto(row)) };

        expect(result.items[0]).toMatchObject({
            publicId: listPublicId(50),
            songs: [{ song: { publicId: songPublicId(7), name: "Visible song" } }],
            dividers: [],
        });
        expect(result.items[0]?.songs?.[0]?.song).not.toHaveProperty("createdByUserId");
        const query = await db3.xEventSongList.CalculateSelectionArgs(authorization, { items: [] }, false, db3.eventSongListDetailView.getSelectionArgs);
        expect(db3.xEventSongList.naturalOrderBy).toEqual([{ sortOrder: "asc" }]);
        if (!query) {
            throw new Error("Missing event-song-list selection.");
        }
        expect(query.select.songs.orderBy).toEqual({ sortOrder: "asc" });
        expect(query.select.songs.where).toBeDefined();
        expect(query.select.dividers.orderBy).toEqual({ sortOrder: "asc" });
    });

    it("returns an explicitly incomplete EventSongList DTO when fields are unauthorized", async () => {
        const rows = [{
            publicId: listPublicId(50),
            name: "Restricted set",
            description: "Restricted",
            eventId: 5,
            event: { publicId: eventPublicId(5) },
            sortOrder: 10,
            isOrdered: true,
            isActuallyPlayed: false,
            songs: [],
            dividers: [],
        }];
        const effectivePermissions = new ServerPermissionSet([
            { id: 1, name: Permission.always_grant },
            { id: 2, name: Permission.public },
        ]);

        const authorization = testBandAuthorization(null, effectivePermissions);
        const projected = rows.map(row => authorizeAndProjectDB3ViewModel(
            db3.eventSongListDetailView.entity, row, authorization, "nested view projection",
        )).filter(row => row !== null);
        const result = { items: projected.map(row => db3.eventSongListDetailView.parseDto(row)) };

        expect(result.items).toEqual([{ publicId: listPublicId(50) }]);
        const dto = db3.eventSongListDetailView.parseDto(result.items[0]);
        expect(db3.hydrateEventSongListDetailDto(dto).content).toBeUndefined();
    });

    it("reports the exact missing reference path", () => {
        const references = db3.createDashboardReferenceStore();
        const dto = instrumentDtoFixture(instrumentPublicId, groupPublicId);

        expect(() => db3.hydrateView(db3.instrumentDashboardView, dto, references))
            .toThrow(`BandInstrument(${instrumentPublicId}).functionalGroupId`);
    });
});


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:tests/authorization/db3Views.test.ts:172-250
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 6f0c652ea9f19dcb356b1eec932281240305da3824b61ac32ab1d44a544a6e39
// MIGRATION_REFERENCE_BEGIN
//     it("derives ordinary selections from DTO schemas and preserves explicit query additions", async () => {
//         const context = {
//             filter: { items: [] },
//             auth: testServerAuthorization(null, new ServerPermissionSet([])),
//         };
//
//         expect(db3.eventTypeEditorView.getSelectionArgs(context)).toEqual({
//             select: {
//                 publicId: true,
//                 text: true,
//                 description: true,
//                 color: true,
//                 sortOrder: true,
//                 significance: true,
//                 iconName: true,
//                 isDeleted: true,
//             },
//         });
//         expect(db3.frontpageGalleryItemEditorView.getSelectionArgs(context))
//             .toMatchObject({
//                 select: {
//                     file: {
//                         select: {
//                             publicId: true,
//                             fileLeafName: true,
//                             storedLeafName: true,
//                             externalURI: true,
//                             sizeBytes: true,
//                             mimeType: true,
//                             customData: true,
//                         },
//                     },
//                     createdByUser: { select: { id: true, name: true } },
//                     visiblePermission: {
//                         select: {
//                             publicId: true,
//                         },
//                     },
//                 },
//             });
//         expect(db3.roleEditorView.getSelectionArgs(context).select.permissions.orderBy)
//             .toEqual([
//                 { permission: { sortOrder: "asc" } },
//                 { permission: { name: "asc" } },
//                 { permission: { id: "asc" } },
//             ]);
//         expect(db3.wikiPageEditorView.getSelectionArgs(context).select.tags.orderBy)
//             .toEqual([
//                 { tag: { sortOrder: "asc" } },
//                 { tag: { text: "asc" } },
//             ]);
//         expect(db3.eventTypeEditorView.getWhereClause(context)).toBeUndefined();
//         expect(db3.songCreditUserView.getWhereClause(context)).toBeUndefined();
//         expect(db3.permissionVisibilityView.getWhereClause(context)).toEqual({
//             isVisibility: { equals: true },
//             id: { in: [] },
//         });
//
//         const permissionDto = db3.permissionVisibilityView.parseDto({
//             publicId: permissionPublicId,
//             name: Permission.visibility_public,
//             description: "Public",
//             descriptionStringPublicId: null,
//             descriptionResolution: {
//                 value: "Public", localeTag: "en-US", scope: "global", source: "stored", reason: "exact", requestedTag: "en-US",
//             },
//             sortOrder: 1,
//             isVisibility: true,
//             significance: null,
//             color: "green",
//             iconName: null,
//         });
//         expectTypeOf(permissionDto.name).toEqualTypeOf<string>();
//         expectTypeOf(permissionDto.description).toEqualTypeOf<string | null>();
//         expectTypeOf(permissionDto.isVisibility).toEqualTypeOf<boolean>();
//
//         expectTypeOf<db3.DbPayloadOf<typeof db3.eventTypeEditorView>>()
//             .toMatchTypeOf<{ publicId: string; text: string }>();
//     });
// MIGRATION_REFERENCE_END
