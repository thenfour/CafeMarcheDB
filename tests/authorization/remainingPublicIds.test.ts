import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import * as db3 from "@db3/db3";
import { createActionRecord } from "@db3/server/recordActionServer";
import { ActivityFeature, ZTRecordActionArgs } from "src/core/components/featureReports/activityTracking";
import {
    projectFeatureReportDetailItem,
    projectGeneralActivityReportDetailItem,
    ZFeatureReportFilterSpec,
} from "src/core/components/featureReports/activityReportTypes";
import { authorizationTestDb } from "./support/inMemoryPrisma";

const customLinkPublicId = db3.xCustomLink.parseIdentity("CustomLinkTest01");
const menuLinkPublicId = db3.xMenuLink.parseIdentity("MenuLinkTest0001");

describe("remaining public identities", () => {
    beforeEach(() => {
        authorizationTestDb.reset({
            customLink: [{ id: 20, publicId: customLinkPublicId, name: "Scores" }],
            menuLink: [{ id: 30, publicId: menuLinkPublicId, caption: "Scores" }],
            action: [],
        });
    });

    it("accepts public link telemetry and stores only internal foreign keys", async () => {
        const input = {
            feature: ActivityFeature.custom_link_update,
            customLinkId: customLinkPublicId,
            menuLinkId: menuLinkPublicId,
        };
        expect(() => ZTRecordActionArgs.parse(input)).not.toThrow();
        expect(() => ZTRecordActionArgs.parse({ ...input, customLinkId: 20 })).toThrow();
        expect(() => ZTRecordActionArgs.parse({ ...input, menuLinkId: 30 })).toThrow();
        await authorizationTestDb.getDelegate("customLink").update({ where: { id: 20 }, data: { bandId: 1 } });
        await authorizationTestDb.getDelegate("menuLink").update({ where: { id: 30 }, data: { bandId: 1 } });
        await createActionRecord({ ...input, isClient: true }, { bandId: 1, localeContextId: null });
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ customLinkId: 20, menuLinkId: 30 });
    });

    it("projects both report shapes with public link IDs", () => {
        const evidence = {
            id: 900, createdAt: new Date(), feature: ActivityFeature.custom_link_update, isClient: true,
            uri: null, queryText: null, context: null, pointerType: null,
            screenWidth: null, screenHeight: null, deviceClass: null, browserName: null,
            operatingSystem: null, language: null, locale: null, timezone: null,
            user: null, userId: null, instrument: null, instrumentId: null, event: null,
            eventId: null, song: null, songId: null, file: null, fileId: null,
            wikiPage: null, wikiPageId: null, eventSegment: null, eventSegmentId: null,
            attendance: null, attendanceId: null, eventSongList: null, eventSongListId: null,
            frontpageGalleryItem: null, frontpageGalleryItemId: null,
            customLink: { publicId: customLinkPublicId, name: "Scores" }, customLinkId: 20,
            menuLink: { publicId: menuLinkPublicId, caption: "Scores" }, menuLinkId: 30,
            setlistPlan: null, setlistPlanId: null, songCreditType: null, songCreditTypeId: null,
        };
        for (const report of [
            projectFeatureReportDetailItem(evidence),
            projectGeneralActivityReportDetailItem(evidence, null),
        ]) {
            expect(report.customLinkId).toBe(customLinkPublicId);
            expect(report.menuLinkId).toBe(menuLinkPublicId);
            expect(report.customLink).toEqual({ publicId: customLinkPublicId, name: "Scores" });
            expect(report.menuLink).toEqual({ publicId: menuLinkPublicId, caption: "Scores" });
            expect(JSON.stringify(report)).not.toContain('"customLinkId":20');
            expect(JSON.stringify(report)).not.toContain('"menuLinkId":30');
        }
    });

    it("rejects numeric identity in link filters and menu reordering", () => {
        expect(() => db3.reorderMenuLinksCommand.dtoSchema.parse({
            movingItemId: 20, newPositionItemId: menuLinkPublicId, scopeRowIds: [20, menuLinkPublicId],
        })).toThrow();
        const filters = ZFeatureReportFilterSpec.partial();
        expect(() => filters.parse({ includeCustomLinkIds: [20] })).toThrow();
        expect(() => filters.parse({ includeMenuLinkIds: [30] })).toThrow();
    });
});
