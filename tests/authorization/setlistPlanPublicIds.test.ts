import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import * as db3 from "@db3/db3";
import executeCommand from "@db3/mutations/executeDB3Command";
import query from "@db3/queries/db3queries";
import upsertSetlistPlan from "@db3/mutations/upsertSetlistPlan";
import deleteSetlistPlan from "@db3/mutations/deleteSetlistPlan";
import reorderSetlistPlans from "@db3/mutations/reorderSetlistPlans";
import { createActionRecord } from "@db3/server/recordActionServer";
import { CreateNewSetlistPlan, ZSetlistPlan } from "@db3/shared/setlistPlanTypes";
import { ActivityFeature, ZTRecordActionArgs } from "src/core/components/featureReports/activityTracking";
import { projectFeatureReportDetailItem, projectGeneralActivityReportDetailItem } from "src/core/components/featureReports/activityReportTypes";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";
import { forgeDb3Query } from "./support/db3RequestBuilders";

const planId = (id: number) => parsePublicId<"SetlistPlan">(`SetlistPlan${String(id).padStart(5, "0")}`);
const groupId = (id: number) => parsePublicId<"SetlistPlanGroup">(`PlanGroup${String(id).padStart(7, "0")}`);
const permissions = [Permission.login, Permission.setlist_planner_access];
const actor = createAuthorizationTestUser("normal", { id: 82, permissions });
const { ctx } = createAuthorizationPersona("normal", { id: actor.id, permissions });

const group = (id: number, sortOrder: number) => ({
    id, publicId: groupId(id), name: `Group ${id}`, description: "", color: null,
    sortOrder, createdByUserId: actor.id, createdAt: new Date(),
});
const plan = (id: number, groupNaturalId: number | null, sortOrder: number, isDeleted = false) => ({
    id, publicId: planId(id), name: `Plan ${id}`, description: "", groupId: groupNaturalId,
    sortOrder, isDeleted, createdByUserId: actor.id, createdAt: new Date(),
    payloadJson: JSON.stringify({ version: 1, rows: [], columns: [], cells: [] }), visiblePermissionId: null,
});

describe("Setlist planning public identities", () => {
    beforeEach(() => {
        authorizationTestDb.reset({
            user: [actor], setlistPlanGroup: [group(20, 0), group(21, 1)],
            setlistPlan: [plan(30, 20, 0), plan(31, 20, 1), plan(32, 21, 8)],
            change: [], action: [],
        });
    });

    it("projects group identity and rejects natural keys in the editor command", () => {
        const dto = db3.setlistPlanGroupEditorView.parseDto({
            ...group(20, 0), createdByUserId: actor.publicId,
        });
        expect(dto).not.toHaveProperty("id");
        expect(dto.publicId).toBe(groupId(20));
        expect(() => db3.setlistPlanGroupEditorView.crud.operations.update.command.parseDto({
            identity: 20, patch: { name: "Renamed" },
        })).toThrow();
    });

    it("creates and reads a group through its public editor view", async () => {
        const operations = db3.setlistPlanGroupEditorView.crud.operations;
        const created = operations.create.command.parseResult(await invokeResolver(executeCommand, {
            commandID: operations.create.command.commandID,
            payload: { name: "Encore", description: "", color: null },
        }, ctx));
        expect(created.identity).toMatch(/^[A-Za-z0-9_-]{16}$/);
        const result = await invokeResolver(query, forgeDb3Query("SetlistPlanGroup", {
            table: { tableID: "SetlistPlanGroup", tableName: "SetlistPlanGroup", viewID: db3.setlistPlanGroupEditorView.viewID },
            filter: { items: [], publicIds: [created.identity] },
        }), ctx);
        expect(result.items[0]).toMatchObject({ publicId: created.identity, name: "Encore" });
        expect(result.items[0]).not.toHaveProperty("id");
    });

    it("creates and updates a plan using public group and plan IDs", async () => {
        const draft = CreateNewSetlistPlan(-1, "New plan", groupId(20), actor.publicId);
        expect(() => db3.xSetlistPlan.identitySchema.parse(30)).toThrow();
        expect(() => ZSetlistPlan.parse({ ...draft, id: 30 })).toThrow();
        const saved = await invokeResolver(upsertSetlistPlan, draft, ctx);
        expect(saved.publicId).toMatch(/^[A-Za-z0-9_-]{16}$/);
        expect(saved).not.toHaveProperty("id");
        expect(saved.groupId).toBe(groupId(20));
        expect(authorizationTestDb.snapshot("setlistPlan").at(-1)).toMatchObject({ groupId: 20, createdByUserId: actor.id });

        const moved = await invokeResolver(upsertSetlistPlan, { ...saved, groupId: groupId(21), name: "Moved" }, ctx);
        expect(moved.groupId).toBe(groupId(21));
        expect(authorizationTestDb.snapshot("setlistPlan").at(-1)).toMatchObject({ groupId: 21, sortOrder: 0 });
        await expect(invokeResolver(upsertSetlistPlan, { ...saved, groupId: groupId(99) }, ctx)).rejects.toThrow();
    });

    it("deletes by public identity and rejects natural IDs", async () => {
        await expect(invokeResolver(deleteSetlistPlan, 30, ctx)).rejects.toThrow();
        await invokeResolver(deleteSetlistPlan, planId(30), ctx);
        expect(authorizationTestDb.snapshot("setlistPlan")[0]).toMatchObject({ id: 30, isDeleted: true });
        await expect(invokeResolver(deleteSetlistPlan, planId(30), ctx)).rejects.toThrow();
    });

    it("reorders only a complete public-ID scope within one group", async () => {
        await invokeResolver(reorderSetlistPlans, {
            kind: "plan", movingPublicId: planId(30), newPositionPublicId: planId(31),
            scopePublicIds: [planId(30), planId(31)], groupId: groupId(20),
        }, ctx);
        expect(authorizationTestDb.snapshot("setlistPlan")).toEqual([
            expect.objectContaining({ id: 30, sortOrder: 1 }),
            expect.objectContaining({ id: 31, sortOrder: 0 }),
            expect.objectContaining({ id: 32, sortOrder: 8 }),
        ]);
        await expect(invokeResolver(reorderSetlistPlans, {
            kind: "plan", movingPublicId: planId(30), newPositionPublicId: planId(32),
            scopePublicIds: [planId(30), planId(32)], groupId: groupId(20),
        }, ctx)).rejects.toThrow();
    });

    it("reorders groups by public ID", async () => {
        await invokeResolver(reorderSetlistPlans, {
            kind: "group", movingPublicId: groupId(20), newPositionPublicId: groupId(21),
            scopePublicIds: [groupId(20), groupId(21)],
        }, ctx);
        expect(authorizationTestDb.snapshot("setlistPlanGroup")).toEqual([
            expect.objectContaining({ id: 20, sortOrder: 1 }),
            expect.objectContaining({ id: 21, sortOrder: 0 }),
        ]);
        await expect(invokeResolver(reorderSetlistPlans, {
            kind: "group", movingPublicId: groupId(20), newPositionPublicId: groupId(21),
            scopePublicIds: [groupId(20), groupId(20), groupId(21)],
        }, ctx)).rejects.toThrow();
    });

    it("records public telemetry with an internal ledger foreign key", async () => {
        const input = { feature: ActivityFeature.setlist_plan_save, setlistPlanId: planId(30) };
        expect(() => ZTRecordActionArgs.parse(input)).not.toThrow();
        expect(() => ZTRecordActionArgs.parse({ ...input, setlistPlanId: 30 })).toThrow();
        await authorizationTestDb.getDelegate("setlistPlan").update({ where: { id: 30 }, data: { bandId: 1 } });
        await createActionRecord({ ...input, isClient: true }, { bandId: 1, localeContextId: null });
        expect(authorizationTestDb.snapshot("action")[0]?.setlistPlanId).toBe(30);
    });

    it("projects the ledger plan reference without its natural ID", () => {
        const evidence = {
            id: 900, createdAt: new Date(), feature: ActivityFeature.setlist_plan_save, isClient: true,
            uri: null, queryText: null, context: null, pointerType: null,
            screenWidth: null, screenHeight: null, deviceClass: null, browserName: null,
            operatingSystem: null, language: null, locale: null, timezone: null,
            user: null, userId: null, instrument: null, instrumentId: null, event: null,
            eventId: null, song: null, songId: null, file: null, fileId: null,
            wikiPage: null, wikiPageId: null, eventSegment: null, eventSegmentId: null,
            attendance: null, attendanceId: null, customLink: null, customLinkId: null,
            eventSongList: null, eventSongListId: null,
            frontpageGalleryItem: null, frontpageGalleryItemId: null,
            menuLink: null, menuLinkId: null,
            setlistPlan: { publicId: planId(30), name: "Plan 30" }, setlistPlanId: 30,
            songCreditType: null, songCreditTypeId: null,
        };
        for (const report of [
            projectFeatureReportDetailItem(evidence),
            projectGeneralActivityReportDetailItem(evidence, null),
        ]) {
            expect(report.setlistPlanId).toBe(planId(30));
            expect(report.setlistPlan).toEqual({ publicId: planId(30), name: "Plan 30" });
            expect(JSON.stringify(report)).not.toContain('"setlistPlanId":30');
        }
    });
});
