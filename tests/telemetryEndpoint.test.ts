import type { Ctx } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the endpoint body without replacing the application's session middleware.
type TestRequest = { method: string; headers: { "content-type"?: string }; body: unknown };
type TestResponse = { status: (code: number) => TestResponse; json: (value: unknown) => TestResponse;
    end: (value?: string) => TestResponse; setHeader: (name: string, value: string[]) => void };
type TestHandler = (req: TestRequest, res: TestResponse, ctx: Ctx) => Promise<unknown>;
const endpoint = vi.hoisted(() => {
    const state: { handler?: TestHandler } = {};
    return state;
});
vi.mock("src/blitz-server", () => ({ api: (value: TestHandler) => { endpoint.handler = value; return value; } }));
vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./authorization/support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import "src/pages/api/telemetry";
import recordActionMutation from "src/core/db3/mutations/recordActionMutation";
import { ActivityFeature, ClientActionRequestSchema } from "src/core/components/featureReports/activityTracking";
import { createAuthorizationPersona } from "./authorization/support/authorizationFixtures";
import { authorizationTestDb } from "./authorization/support/inMemoryPrisma";
import { invokeResolver } from "./authorization/support/resolverHarness";

const body = { event: { feature: ActivityFeature.profile_view },
    presentation: { bandPublicId: "TelemetryBand001", routeLocale: "fr-BE" } };

beforeEach(() => {
    vi.restoreAllMocks();
    authorizationTestDb.reset({ band: [{ id: 1, publicId: "TelemetryBand001", isDeleted: false }],
        locale: [{ id: 2, ietfTag: "fr-BE", isDeleted: false }], action: [] });
});

async function post(payload: unknown, contentType = "application/json", method = "POST") {
    const status = vi.fn();
    const json = vi.fn();
    const end = vi.fn();
    const setHeader = vi.fn();
    const response: TestResponse = { status: code => { status(code); return response; },
        json: value => { json(value); return response; }, end: value => { end(value); return response; }, setHeader };
    const { ctx } = createAuthorizationPersona("public");
    if (!endpoint.handler) {
        throw new Error("Telemetry endpoint did not initialize.");
    }
    await endpoint.handler({ method, headers: { "content-type": contentType }, body: payload }, response, ctx);
    return { status, json, end, setHeader };
}

describe("HTTP and RPC telemetry boundaries", () => {
    it.each(["application/json", "text/plain;charset=UTF-8"])("records valid %s requests with explicit context", async contentType => {
        const response = await post(contentType.startsWith("text/plain") ? JSON.stringify(body) : body, contentType);
        expect(response.status).toHaveBeenCalledWith(204);
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ bandId: 1, localeContextId: 2, userId: null });
    });

    it.each([
        null, {}, { event: body.event }, { ...body, userId: 7 },
        { ...body, event: { ...body.event, userId: 7 } },
        { ...body, event: { ...body.event, bandId: 1 } },
        { ...body, event: { ...body.event, localeContextId: 2 } },
        { ...body, event: { ...body.event, bandInstrumentId: 108 } },
        { ...body, presentation: { bandPublicId: 1 } },
        { ...body, presentation: { routeLocale: "invalid locale" } },
    ])("rejects malformed or forged HTTP payload %# before writing", async payload => {
        expect((await post(payload)).status).toHaveBeenCalledWith(400);
        expect(authorizationTestDb.snapshot("action")).toEqual([]);
    });

    it("rejects invalid plain-text JSON and unsupported HTTP methods", async () => {
        expect((await post("{broken", "text/plain")).status).toHaveBeenCalledWith(400);
        const response = await post(body, "application/json", "GET");
        expect(response.status).toHaveBeenCalledWith(405);
        expect(response.setHeader).toHaveBeenCalledWith("Allow", ["POST"]);
        expect(authorizationTestDb.snapshot("action")).toEqual([]);
    });

    it("returns 404 for an unavailable band without persisting or inferring a default", async () => {
        const response = await post({ ...body, presentation: { bandPublicId: "TelemetryBand002" } });
        expect(response.status).toHaveBeenCalledWith(404);
        expect(authorizationTestDb.snapshot("action")).toEqual([]);
    });

    it("records RPC telemetry through the same explicit context", async () => {
        const { ctx } = createAuthorizationPersona("public");
        await invokeResolver(recordActionMutation, ClientActionRequestSchema.parse(body), ctx);
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ bandId: 1, localeContextId: 2, userId: null });
    });
});
