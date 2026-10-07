import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";

vi.mock("db", async () => ({ ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"), default: {} }));
vi.mock("src/auth/server/serverAuthorization", async () => ({
    ...await vi.importActual<typeof import("src/auth/server/serverAuthorization")>("src/auth/server/serverAuthorization"),
    loadAuthorization: vi.fn(),
}));
vi.mock("src/core/db3/server/eventAttendanceBulk", () => ({ copyEventSegmentResponses: vi.fn(), clearEventSegmentResponses: vi.fn() }));

import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { copyEventSegmentResponses, clearEventSegmentResponses } from "src/core/db3/server/eventAttendanceBulk";
import copyResponses from "src/core/db3/mutations/copyEventSegmentResponses";
import clearResponses from "src/core/db3/mutations/clearEventSegmentResponses";
import { createAuthorizationPersona } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";

const bandPublicId = parsePublicId<"Band">("AttendanceBand01");
const fromEventSegmentId = parsePublicId<"EventSegment">("AttendanceSet001");
const toEventSegmentId = parsePublicId<"EventSegment">("AttendanceSet002");
const persona = createAuthorizationPersona("normal");

describe("bulk attendance RPC boundaries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(loadAuthorization).mockResolvedValue(persona.schemaAuthorization);
    });

    it("forwards copy scope and public segment IDs to the transaction owner", async () => {
        const args = { bandPublicId, fromEventSegmentId, toEventSegmentId };
        vi.mocked(copyEventSegmentResponses).mockResolvedValue(null);
        expect(await invokeResolver(copyResponses, args, persona.ctx)).toBeNull();
        expect(loadAuthorization).toHaveBeenCalledWith(persona.ctx.session, bandPublicId);
        expect(copyEventSegmentResponses).toHaveBeenCalledWith({}, persona.schemaAuthorization, args);
    });

    it("forwards clear scope and the public segment ID to the transaction owner", async () => {
        const args = { bandPublicId, eventSegmentId: toEventSegmentId };
        vi.mocked(clearEventSegmentResponses).mockResolvedValue(null);
        expect(await invokeResolver(clearResponses, args, persona.ctx)).toBeNull();
        expect(loadAuthorization).toHaveBeenCalledWith(persona.ctx.session, bandPublicId);
        expect(clearEventSegmentResponses).toHaveBeenCalledWith({}, persona.schemaAuthorization, args);
    });

    it.each([
        { fromEventSegmentId, toEventSegmentId },
        { bandPublicId: null, fromEventSegmentId, toEventSegmentId },
        { bandPublicId: 1, fromEventSegmentId, toEventSegmentId },
        { bandPublicId, fromEventSegmentId: 1, toEventSegmentId },
        { bandPublicId, fromEventSegmentId, toEventSegmentId: 2 },
        { bandPublicId, fromEventSegmentId, toEventSegmentId: fromEventSegmentId },
        { bandPublicId, fromEventSegmentId, toEventSegmentId, bandUserId: 1 },
        { bandPublicId, fromEventSegmentId, toEventSegmentId, updatedByUserId: 1 },
    ])("rejects forged copy input before authorization/database access: %j", async input => {
        // Forged transport deliberately bypasses the branded client type.
        await expect(invokeResolver(copyResponses, input as never, persona.ctx)).rejects.toThrow();
        expect(loadAuthorization).not.toHaveBeenCalled();
        expect(copyEventSegmentResponses).not.toHaveBeenCalled();
    });

    it.each([
        { eventSegmentId: toEventSegmentId },
        { bandPublicId: null, eventSegmentId: toEventSegmentId },
        { bandPublicId: [bandPublicId], eventSegmentId: toEventSegmentId },
        { bandPublicId, eventSegmentId: 2 },
        { bandPublicId, eventSegmentId: "2suffix" },
        { bandPublicId, eventSegmentId: toEventSegmentId, bandUserId: 1 },
    ])("rejects forged clear input before authorization/database access: %j", async input => {
        // Forged transport deliberately bypasses the branded client type.
        await expect(invokeResolver(clearResponses, input as never, persona.ctx)).rejects.toThrow();
        expect(loadAuthorization).not.toHaveBeenCalled();
        expect(clearEventSegmentResponses).not.toHaveBeenCalled();
    });
});
