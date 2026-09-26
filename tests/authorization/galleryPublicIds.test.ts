import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import * as db3 from "@db3/db3";
import executeDB3CommandMutation from "@db3/mutations/executeDB3Command";
import updateGenericSortOrder from "@db3/mutations/updateGenericSortOrder";
import { ActivityFeature, ZTRecordActionArgs } from "src/core/components/featureReports/activityTracking";
import { projectFeatureReportDetailItem, projectGeneralActivityReportDetailItem } from "src/core/components/featureReports/activityReportTypes";
import { createActionRecord } from "@db3/server/recordActionServer";
import { MakePublicFeedResponseSpec } from "src/core/db3/shared/publicFeedApi";
import { Permission } from "shared/permissions";
import type { FrontpageGalleryItemPublicId } from "shared/publicId";
import { galleryPublicId } from "../support/galleryFixtures";
import { createAuthorizationPersona, createAuthorizationTestUser, testPublicRolePermissions } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

const galleryRow = (id: number, sortOrder: number, isDeleted = false) => ({
    id,
    publicId: galleryPublicId(id),
    sortOrder,
    isDeleted,
    caption: `Image ${id}`,
    caption_nl: null,
    caption_fr: null,
    displayParams: "{}",
    fileId: 10,
    createdByUserId: null,
    visiblePermissionId: 700,
});

const publicRole = {
    id: 900,
    isPublicRole: true,
    permissions: testPublicRolePermissions.map((name, index) => ({
        permissionId: name === Permission.visibility_public ? 700 : 701 + index,
        permission: { id: name === Permission.visibility_public ? 700 : 701 + index, name },
    })),
};

describe("FrontpageGalleryItem public identity", () => {
    beforeEach(() => {
        authorizationTestDb.reset({ user: [], role: [publicRole], frontpageGalleryItem: [], change: [], action: [] });
    });

    it("projects a public feed item without its natural key", () => {
        const dto = db3.frontpageGalleryFeedView.parseDto({
            id: 20,
            publicId: galleryPublicId(20),
            sortOrder: 2,
            caption: "Concert",
            displayParams: "{}",
            file: {
                publicId: "File000000000020",
                storedLeafName: "concert.jpg",
                customData: null,
                mimeType: "image/jpeg",
            },
        });
        expect(dto).not.toHaveProperty("id");
        expectTypeOf(dto.publicId).toEqualTypeOf<FrontpageGalleryItemPublicId>();
        const feed = MakePublicFeedResponseSpec([], "en", [{
            publicId: galleryPublicId(20),
            sortOrder: 2,
            caption: "Concert",
            displayParams: "{}",
            file: { storedLeafName: "concert.jpg", customData: null, mimeType: "image/jpeg" },
        }]);
        expect(feed.gallery[0]?.id).toBe(galleryPublicId(20));
    });

    it("rejects numeric and incomplete reorder scopes", () => {
        expect(() => db3.reorderGalleryItemsCommand.parseDto({
            movingItemId: 20,
            newPositionItemId: 21,
            scopeRowIds: [20, 21],
        })).toThrow();
        expect(() => db3.reorderGalleryItemsCommand.parseDto({
            movingItemId: galleryPublicId(20),
            newPositionItemId: galleryPublicId(21),
            scopeRowIds: [galleryPublicId(20)],
        })).toThrow();
    });

    it("rejects the old numeric reorder mutation", async () => {
        const permissions = [Permission.login, Permission.edit_public_homepage];
        const actor = createAuthorizationTestUser("normal", { id: 5, permissions });
        authorizationTestDb.reset({ user: [actor], role: [publicRole], frontpageGalleryItem: [galleryRow(20, 0)] });
        const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });
        await expect(invokeResolver(updateGenericSortOrder, {
            tableID: "FrontpageGalleryItem",
            tableName: "FrontpageGalleryItem",
            movingItemId: 20,
            newPositionItemId: 20,
            scopeRowIds: [20],
        }, ctx)).rejects.toThrow();
    });

    it("reorders scoped rows and leaves an unrelated row unchanged", async () => {
        const permissions = [Permission.login, Permission.edit_public_homepage];
        const actor = createAuthorizationTestUser("normal", { id: 5, permissions });
        authorizationTestDb.reset({
            user: [actor],
            role: [publicRole],
            frontpageGalleryItem: [galleryRow(20, 0), galleryRow(21, 1), galleryRow(22, 7)],
            change: [],
        });
        const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });
        await invokeResolver(executeDB3CommandMutation, {
            commandID: db3.reorderGalleryItemsCommand.commandID,
            payload: {
                movingItemId: galleryPublicId(20),
                newPositionItemId: galleryPublicId(21),
                scopeRowIds: [galleryPublicId(20), galleryPublicId(21)],
            },
        }, ctx);
        expect(authorizationTestDb.snapshot("frontpageGalleryItem")).toEqual([
            expect.objectContaining({ id: 20, sortOrder: 1 }),
            expect.objectContaining({ id: 21, sortOrder: 0 }),
            expect.objectContaining({ id: 22, sortOrder: 7 }),
        ]);
    });

    it("rejects a deleted scoped row before writing", async () => {
        const permissions = [Permission.login, Permission.edit_public_homepage];
        const actor = createAuthorizationTestUser("normal", { id: 5, permissions });
        authorizationTestDb.reset({
            user: [actor],
            role: [publicRole],
            frontpageGalleryItem: [galleryRow(20, 0), galleryRow(21, 1, true)],
            change: [],
        });
        const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });
        await expect(invokeResolver(executeDB3CommandMutation, {
            commandID: db3.reorderGalleryItemsCommand.commandID,
            payload: {
                movingItemId: galleryPublicId(20),
                newPositionItemId: galleryPublicId(21),
                scopeRowIds: [galleryPublicId(20), galleryPublicId(21)],
            },
        }, ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("accepts public telemetry identity and resolves its storage foreign key", async () => {
        authorizationTestDb.reset({ role: [publicRole], frontpageGalleryItem: [galleryRow(20, 0)], action: [] });
        const input = {
            feature: ActivityFeature.frontpagegallery_item_edit,
            frontpageGalleryItemId: galleryPublicId(20),
            isClient: true,
        };
        expect(() => ZTRecordActionArgs.parse({ ...input, frontpageGalleryItemId: 20 })).toThrow();
        await createActionRecord(input);
        expect(authorizationTestDb.snapshot("action")[0]?.frontpageGalleryItemId).toBe(20);
    });

    it("projects gallery report references without natural row identity", () => {
        const evidence = {
            id: 900, createdAt: new Date(), feature: ActivityFeature.frontpagegallery_item_edit, isClient: true,
            uri: null, queryText: null, context: null, pointerType: null,
            screenWidth: null, screenHeight: null, deviceClass: null, browserName: null,
            operatingSystem: null, language: null, locale: null, timezone: null,
            user: null, userId: null, instrument: null, instrumentId: null, event: null,
            eventId: null, song: null, songId: null, file: null, fileId: null,
            wikiPage: null, wikiPageId: null, eventSegment: null, eventSegmentId: null,
            attendance: null, attendanceId: null, customLink: null, customLinkId: null,
            eventSongList: null, eventSongListId: null,
            frontpageGalleryItem: { publicId: galleryPublicId(20) }, frontpageGalleryItemId: 20,
            menuLink: null, menuLinkId: null, setlistPlan: null, setlistPlanId: null,
            songCreditType: null, songCreditTypeId: null,
        };
        for (const report of [
            projectFeatureReportDetailItem(evidence),
            projectGeneralActivityReportDetailItem(evidence, null),
        ]) {
            expect(report.frontpageGalleryItemId).toBe(galleryPublicId(20));
            expect(report.frontpageGalleryItem).toEqual({ publicId: galleryPublicId(20) });
        }
    });
});
