import { AuthenticationError, AuthorizationError, NotFoundError, type Ctx } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";

vi.mock("src/blitz-server", () => ({ api: (handler: unknown) => handler }));
vi.mock("db", async () => ({ ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"), default: {} }));
vi.mock("src/auth/server/serverAuthorization", async () => ({
    ...await vi.importActual<typeof import("src/auth/server/serverAuthorization")>("src/auth/server/serverAuthorization"),
    loadAuthorization: vi.fn(),
}));
vi.mock("src/core/db3/server/eventAttendanceWrite", () => ({ updateEventAttendance: vi.fn(), EventAttendanceAuthorizationError: class extends Error {} }));
vi.mock("src/core/db3/server/eventAttendanceRead", () => ({ readUserEventAttendance: vi.fn(), readUserAttendanceHistory: vi.fn() }));

import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { readUserAttendanceHistory, readUserEventAttendance } from "src/core/db3/server/eventAttendanceRead";
import { updateEventAttendance } from "src/core/db3/server/eventAttendanceWrite";
import updateAttendance from "src/core/db3/mutations/updateUserEventAttendanceMutation";
import getHistory from "src/core/db3/queries/getUserEventAttendance";
import attendanceApi from "src/pages/api/event/getUserAttendance";
import { GetBandUserEventAttendanceSchema } from "src/auth/schemas";
import { ZupdateUserEventAttendanceMutationArgs } from "src/core/db3/shared/apiTypes";
import { createAuthorizationPersona } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";

const input = { bandPublicId: parsePublicId<"Band">("AttendanceBand01"), userId: parsePublicId<"User">("AttendanceUser01"), eventId: parsePublicId<"Event">("AttendanceEvent1") };
const persona = createAuthorizationPersona("normal");
const ctx = persona.ctx;
const authorization = persona.schemaAuthorization;

// The Blitz wrapper is replaced above; this boundary uses only these request/response members.
const handler = attendanceApi as unknown as (req: { method: string; query: object },
    res: { status: (status: number) => { json: (value: unknown) => void }; setHeader: (name: string, value: string) => void }, context: Ctx) => Promise<void>;

function response() {
    const json = vi.fn();
    return { json, status: vi.fn(() => ({ json })), setHeader: vi.fn() };
}

describe("band-scoped attendance request boundaries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(loadAuthorization).mockResolvedValue(authorization);
    });

    it("passes explicit band selection through the write RPC and returns public transport data", async () => {
        vi.mocked(updateEventAttendance).mockResolvedValue({ ...input, comment: "" });
        const result = await invokeResolver(updateAttendance, { ...input, comment: "" }, ctx);
        expect(loadAuthorization).toHaveBeenCalledWith(ctx.session, input.bandPublicId);
        expect(updateEventAttendance).toHaveBeenCalledWith({}, authorization, { ...input, comment: "" });
        expect(result).toEqual({ ...input, comment: "" });
    });

    it("passes the report band context and pagination to the scoped reader", async () => {
        const args = { bandPublicId: input.bandPublicId, userId: input.userId, take: 50 };
        vi.mocked(readUserAttendanceHistory).mockResolvedValue({ events: [] });
        expect(await invokeResolver(getHistory, args, ctx)).toEqual({ events: [] });
        expect(loadAuthorization).toHaveBeenCalledWith(ctx.session, input.bandPublicId);
        expect(readUserAttendanceHistory).toHaveBeenCalledWith({}, authorization, args);
    });

    it.each([
        { ...input, bandPublicId: undefined, comment: "" },
        { ...input, bandPublicId: null, comment: "" },
        { ...input, bandPublicId: 1, comment: "" },
        { ...input, userId: 1, comment: "" },
        { ...input, eventId: 1, comment: "" },
        { ...input, instrumentId: 1 },
        { ...input, comment: "", bandUserId: 5 },
        { ...input, comment: "", createdByUserId: 5 },
        { ...input, segmentResponses: { bad: { attendanceId: null } } },
        { ...input, segmentResponses: { AttendanceSet001: { attendanceId: 1 } } },
        { ...input, segmentResponses: {} },
        input,
    ])("rejects invalid write input before loading authorization or writing: %j", async invalid => {
        // Deliberately forged input exercises the server schema independently of client types.
        await expect(invokeResolver(updateAttendance, invalid as never, ctx)).rejects.toThrow();
        expect(loadAuthorization).not.toHaveBeenCalled();
        expect(updateEventAttendance).not.toHaveBeenCalled();
    });

    it("limits batch size and validates integer bounded history pagination", () => {
        const segmentResponses = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`Segment${String(index).padStart(9, "0")}`, { attendanceId: null }]));
        expect(() => ZupdateUserEventAttendanceMutationArgs.parse({ ...input, segmentResponses })).toThrow("At most 1000");
        for (const take of [0, -1, 1.5, 1001, Infinity]) {
            expect(() => GetBandUserEventAttendanceSchema.parse({ bandPublicId: input.bandPublicId, userId: input.userId, take })).toThrow();
        }
    });

    it("delivers HTTP attendance through the same scoped reader", async () => {
        const ret = { userId: input.userId, eventId: input.eventId, comment: "", instrumentId: null, segmentResponses: [] };
        vi.mocked(readUserEventAttendance).mockResolvedValue(ret);
        const res = response();
        await handler({ method: "GET", query: input }, res, ctx);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(ret);
        expect(loadAuthorization).toHaveBeenCalledWith(ctx.session, input.bandPublicId);
        expect(readUserEventAttendance).toHaveBeenCalledWith({}, authorization, input);
    });

    it.each([
        { userId: input.userId, eventId: input.eventId },
        { ...input, bandPublicId: [input.bandPublicId, input.bandPublicId] },
        { ...input, userId: [input.userId] },
        { ...input, eventId: "123" },
        { ...input, bandUserId: "1" },
    ])("returns 400 for malformed HTTP input: %j", async query => {
        const res = response();
        await handler({ method: "GET", query }, res, ctx);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(loadAuthorization).not.toHaveBeenCalled();
        expect(readUserEventAttendance).not.toHaveBeenCalled();
    });

    it.each([[new AuthenticationError(), 401], [new AuthorizationError(), 403], [new NotFoundError(), 404]] as const)("maps attendance access failures to HTTP status", async (error, status) => {
        vi.mocked(readUserEventAttendance).mockRejectedValue(error);
        const res = response();
        await handler({ method: "GET", query: input }, res, ctx);
        expect(res.status).toHaveBeenCalledWith(status);
    });

    it("rejects unsupported methods before any authorization/database access", async () => {
        const res = response();
        await handler({ method: "POST", query: input }, res, ctx);
        expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
        expect(res.status).toHaveBeenCalledWith(405);
        expect(loadAuthorization).not.toHaveBeenCalled();
    });
});
