import { AuthenticationError, type Ctx } from "blitz";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import type { UploadResponsePayload } from "src/core/db3/shared/fileTypes";
import { ApplicationFeatureUnavailableError } from "src/core/shared/applicationRecovery";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";

type TestRequest = { method: string };
interface TestResponse {
    status: (code: number) => TestResponse;
    json: (payload: UploadResponsePayload) => TestResponse;
    end: () => void;
    setHeader: (name: string, value: string) => void;
}
type TestHandler = (req: TestRequest, res: TestResponse, ctx: Ctx) => Promise<void>;
const endpoint = vi.hoisted(() => {
    const state: { handler?: TestHandler } = {};
    return state;
});
vi.mock("src/blitz-server", () => ({ api: (handler: TestHandler) => {
    endpoint.handler = handler;
    return handler;
} }));
vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    return { ...prisma, default: new Proxy({}, {
        get: () => {
            throw new Error("Deferred upload accessed the database.");
        },
    }) };
});
vi.mock("formidable", () => ({ default: () => {
    throw new Error("Deferred upload parsed multipart data.");
} }));

import { config } from "src/pages/api/files/upload";
import { CMDBUploadFile } from "src/core/components/file/CMDBUploadFile";

function responseSpies() {
    const status = vi.fn();
    const json = vi.fn();
    const end = vi.fn();
    const setHeader = vi.fn();
    const response: TestResponse = {
        status: code => {
            status(code);
            return response;
        },
        json: payload => {
            json(payload);
            return response;
        },
        end, setHeader,
    };
    return { response, status, json, end, setHeader };
}

async function invokeUpload(method: string, actor: ReturnType<typeof createAuthorizationTestUser> | null, response: TestResponse) {
    const request = new Proxy({ method }, {
        get: (target, member) => {
            if (member === "method") {
                return target.method;
            }
            throw new Error(`Deferred upload inspected request ${String(member)}.`);
        },
    });
    if (!endpoint.handler) {
        throw new Error("Upload endpoint did not initialize.");
    }
    const context = createAuthorizationTestContext(actor);
    if (!actor) {
        // Use the real Blitz exception so the HTTP mapping is exercised.
        context.session.$authorize = () => {
            throw new AuthenticationError();
        };
    }
    await endpoint.handler(request, response, context);
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("deferred upload HTTP boundary", () => {
    it.each(["normal", "bandAdmin", "sysadmin"] as const)("returns an empty 503 for %s without consuming multipart data or context", async persona => {
        const actor = createAuthorizationTestUser(persona, { permissions: [Permission.login, Permission.upload_files] });
        const spies = responseSpies();
        await invokeUpload("POST", actor, spies.response);
        expect(config.api.bodyParser).toBe(false);
        expect(spies.status).toHaveBeenCalledWith(503);
        expect(spies.json).toHaveBeenCalledWith({
            files: [], isSuccess: false,
            errorMessage: new ApplicationFeatureUnavailableError("fileCreation").message,
        });
    });

    it("requires login before consuming the request or reporting upload availability", async () => {
        const spies = responseSpies();
        await invokeUpload("POST", null, spies.response);
        expect(spies.status).toHaveBeenCalledWith(401);
        expect(spies.json).toHaveBeenCalledWith({
            files: [], isSuccess: false, errorMessage: new AuthenticationError().message,
        });
    });

    it.each(["GET", "HEAD", "PUT"])("rejects %s with the supported method", async method => {
        const spies = responseSpies();
        await invokeUpload(method, createAuthorizationTestUser("normal"), spies.response);
        expect(spies.status).toHaveBeenCalledWith(405);
        expect(spies.setHeader).toHaveBeenCalledWith("Allow", "POST");
        expect(spies.end).toHaveBeenCalledOnce();
        expect(spies.json).not.toHaveBeenCalled();
    });
});

describe("deferred upload client boundary", () => {
    it.each([{}, { externalURI: "https://example.com/recording.mp3" }])("rejects without multipart/network/progress work for %j", async fields => {
        const forbidden = vi.fn(() => {
            throw new Error("Upload constructed browser transport.");
        });
        vi.stubGlobal("FormData", forbidden);
        vi.stubGlobal("XMLHttpRequest", forbidden);
        const onProgress = vi.fn();
        await expect(CMDBUploadFile({ files: null, fields, onProgress, maxImageDimension: 750 }))
            .rejects.toThrow(ApplicationFeatureUnavailableError);
        expect(forbidden).not.toHaveBeenCalled();
        expect(onProgress).not.toHaveBeenCalled();
    });
});
