import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { classifyRecords } from "src/auth/server/userMerge/classifyRecords";
import { userMergePolicies } from "src/auth/server/userMerge/policies";
import { songCreditsPolicy } from "src/auth/server/userMerge/policies/songCredits";
import { eventResponsesPolicy } from "src/auth/server/userMerge/policies/eventResponses";
import { instrumentsPolicy } from "src/auth/server/userMerge/policies/instruments";
import { setlistReferencesPolicy } from "src/auth/server/userMerge/policies/setlistReferences";
import { signInMethodsPolicy } from "src/auth/server/userMerge/policies/signInMethods";
import { userTagsPolicy } from "src/auth/server/userMerge/policies/userTags";
import type { MergeContext, MergePolicy } from "src/auth/server/userMerge/types";
import { userPublicId } from "./support/userFixtures";

const mainUserId = 10;
const retiringUserId = 20;
const context = (db: unknown, main = {}, retiring = {}) => ({
    db, mainUserId, retiringUserId,
    main: { publicId: userPublicId(mainUserId), hashedPassword: null, ...main },
    retiring: { publicId: userPublicId(retiringUserId), hashedPassword: null, ...retiring },
}) as unknown as MergeContext; // Policy test double supplies only fields read by the policy.
const count = (step: Awaited<ReturnType<MergePolicy["prepare"]>>, label: string) => step.report.effects.find(effect => effect.label === label)?.count;

describe("user merge policy coverage", () => {
    it("gives every User foreign key exactly one policy", () => {
        const actual = Prisma.dmmf.datamodel.models.flatMap(model => model.fields
            .filter(field => field.type === "User" && field.relationFromFields?.length)
            .flatMap(field => field.relationFromFields!.map(name => `${model.name}.${name}`)));
        const declared = userMergePolicies.flatMap(policy => policy.userRelations);
        expect([...declared].sort()).toEqual(actual.sort());
        expect(new Set(declared).size).toBe(declared.length);
        expect(new Set(userMergePolicies.map(policy => policy.key)).size).toBe(userMergePolicies.length);
    });

    it("retains Main even when Retiring's record was created first", () => {
        const old = { id: 1, userId: retiringUserId, key: 5 };
        const main = { id: 9, userId: mainUserId, key: 5 };
        expect(classifyRecords([old, main], mainUserId, record => record.key).overlaps).toEqual([{ retained: main, discarded: old }]);
    });
});

describe("song-credit policy", () => {
    it("deduplicates exact credits, preserves distinct comments and years, and reports its actual writes", async () => {
        const common = { songId: 1, typeId: 2, year: "2025", comment: "private-credit-text" };
        const rows = [
            { ...common, id: 1, userId: mainUserId },
            { ...common, id: 2, userId: retiringUserId },
            { ...common, id: 3, userId: retiringUserId, year: "2026" },
            { ...common, id: 4, userId: retiringUserId, year: "2026" },
            { ...common, id: 5, userId: retiringUserId, comment: "different private text" },
        ];
        const delegate = { findMany: vi.fn().mockResolvedValue(rows), deleteMany: vi.fn(), updateMany: vi.fn() };
        const ctx = context({ songCredit: delegate });
        const step = await songCreditsPolicy.prepare(ctx);
        expect(count(step, "Credits transferred")).toBe(2);
        expect(count(step, "Exact duplicates removed")).toBe(2);
        expect(JSON.stringify(step.report)).not.toContain("private-credit-text");
        await step.apply(ctx.db);
        expect(delegate.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [2, 4] } } });
        expect(delegate.updateMany).toHaveBeenCalledWith({ where: { id: { in: [3, 5] } }, data: { userId: mainUserId } });
    });
});

describe("event response policy", () => {
    it("respects Main's blanks and distinguishes overlaps from differing comments", async () => {
        const rows = [
            { id: 1, userId: mainUserId, eventId: 1, userComment: "", instrumentId: null, isInvited: null },
            { id: 2, userId: retiringUserId, eventId: 1, userComment: "private response", instrumentId: 7, isInvited: true },
            { id: 3, userId: mainUserId, eventId: 2, userComment: "same", instrumentId: null, isInvited: false },
            { id: 4, userId: retiringUserId, eventId: 2, userComment: "same", instrumentId: null, isInvited: false },
            { id: 5, userId: retiringUserId, eventId: 3, userComment: "transfer me", instrumentId: null, isInvited: null },
        ];
        const step = await eventResponsesPolicy.prepare(context({ eventUserResponse: { findMany: async () => rows } }));
        expect(count(step, "Responses transferred")).toBe(1);
        expect(count(step, "Overlapping responses resolved in favor of Main")).toBe(2);
        expect(count(step, "Overlapping responses with different values")).toBe(1);
        expect(count(step, "Different non-empty comments discarded")).toBe(1);
        expect(JSON.stringify(step.report)).not.toContain("private response");
    });
});

describe("memberships and instruments", () => {
    it("does not restore Retiring-only membership", async () => {
        const step = await userTagsPolicy.prepare(context({ userTagAssignment: { findMany: async () => [
            { id: 1, userId: mainUserId, userTagId: 7 }, { id: 2, userId: retiringUserId, userTagId: 7 }, { id: 3, userId: retiringUserId, userTagId: 8 },
        ] } }));
        expect(count(step, "Memberships present only on Retiring discarded")).toBe(1);
        expect(count(step, "Shared memberships retained on Main")).toBe(1);
    });

    it("imports only distinct non-primary instruments and blocks ambiguous Main instruments", async () => {
        const rows = [{ id: 1, userId: mainUserId, instrumentId: 7, isPrimary: true },
            { id: 2, userId: retiringUserId, instrumentId: 8, isPrimary: true }];
        const delegate = { findMany: async () => rows, deleteMany: vi.fn(), updateMany: vi.fn() };
        const ctx = context({ userInstrument: delegate });
        const step = await instrumentsPolicy.prepare(ctx);
        await step.apply(ctx.db);
        expect(delegate.updateMany).toHaveBeenCalledWith({ where: { id: { in: [2] } }, data: { userId: mainUserId, isPrimary: false } });
        rows.push({ id: 3, userId: mainUserId, instrumentId: 9, isPrimary: true });
        expect((await instrumentsPolicy.prepare(ctx)).report.blockers).toHaveLength(1);
    });
});

describe("fixed password policy", () => {
    it.each([
        ["main-hash", "retiring-hash", "Main's existing password", true],
        [null, "retiring-hash", "Retiring's existing password", true],
        [null, null, "No password is set", false],
    ])("selects password without asking a data-dependent question (%s, %s)", async (main, retiring, description, usable) => {
        const step = await signInMethodsPolicy.prepare(context({ userSignInMethod: { findMany: async () => [
            { id: 1, userId: retiringUserId, type: "email", identifier: "private-alias@example.invalid" },
        ] } }, { hashedPassword: main }, { hashedPassword: retiring }));
        expect(step.report.consequences?.[0]).toContain(description);
        expect(step.report.blockers).toHaveLength(usable ? 0 : 1);
        expect(JSON.stringify(step.report)).not.toContain("private-alias");
        expect(JSON.stringify(step.report)).not.toContain("-hash");
    });
});

describe("unsupported embedded references", () => {
    it.each(["columns", "columnLeds", "rowLeds"])("blocks user references in %s without disclosing plan data", async field => {
        const item = field === "columns" ? { columnId: "c", name: "private column" } : { ledId: "l", name: "private LED" };
        const payload = { version: 1, columns: [], rows: [], cells: [], [field]: [{ ...item, associatedItem: { itemType: "user", id: userPublicId(retiringUserId), name: "private name" } }] };
        const step = await setlistReferencesPolicy.prepare(context({ setlistPlan: { findMany: async () => [{ id: 1, payloadJson: JSON.stringify(payload) }] } }));
        expect(step.report.blockers).toHaveLength(1);
        expect(count(step, "Plans referencing Retiring")).toBe(1);
        expect(JSON.stringify(step.report)).not.toContain("private");
    });

    it("blocks malformed JSON rather than treating it as an empty plan", async () => {
        const step = await setlistReferencesPolicy.prepare(context({ setlistPlan: { findMany: async () => [{ id: 1, payloadJson: "invalid" }] } }));
        expect(count(step, "Unreadable plans")).toBe(1);
        expect(step.report.blockers).toHaveLength(1);
    });
});
