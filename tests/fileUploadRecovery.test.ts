import { AuthenticationError, AuthorizationError } from "blitz";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Ctx } from "@blitzjs/next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import type { UploadResponsePayload } from "src/core/db3/shared/fileTypes";
import { FileUploadArgsSchema } from "src/core/db3/shared/fileUpload";
import { DB3PublicIdError } from "src/core/db3/server/db3PublicIds";

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(), loadAuthorization: vi.fn(), parse: vi.fn(), upload: vi.fn(),
    mkdir: vi.fn(), mkdtemp: vi.fn(), rm: vi.fn(),
}));
vi.mock("src/blitz-server", () => ({ api: (handler: unknown) => handler }));
vi.mock("src/auth/server/serverAuthorization", async () => ({
    ...await vi.importActual<object>("src/auth/server/serverAuthorization"), loadAuthorization: mocks.loadAuthorization,
}));
vi.mock("node:fs/promises", async () => ({
    ...await vi.importActual<object>("node:fs/promises"), mkdir: mocks.mkdir, mkdtemp: mocks.mkdtemp, rm: mocks.rm,
}));
vi.mock("formidable", () => ({ default: () => ({ parse: mocks.parse }) }));
vi.mock("src/core/db3/server/fileUpload", async () => ({
    ...await vi.importActual<object>("src/core/db3/server/fileUpload"), uploadFiles: mocks.upload,
}));
vi.mock("@blitzjs/auth", async () => ({
    ...await vi.importActual<object>("@blitzjs/auth"), getAntiCSRFToken: () => "test-csrf",
}));
import { config, uploadFileRoute } from "src/pages/api/files/upload";
import { CMDBUploadFile } from "src/core/components/file/CMDBUploadFile";

const bandPublicId = parsePublicId<"Band">("UploadBand000001");
function responseSpies() {
    const status = vi.fn(); const json = vi.fn(); const end = vi.fn(); const setHeader = vi.fn();
    const response = { status: (code: number) => { status(code); return response; },
        json: (payload: UploadResponsePayload) => { json(payload); return response; }, end, setHeader };
    // Only these response methods are exercised by the upload handler.
    return { response: response as unknown as NextApiResponse<UploadResponsePayload>, status, json, end, setHeader };
}
async function invoke(method = "POST", query: object = { bandPublicId }) {
    const spies = responseSpies();
    // Multipart parsing is mocked separately; the handler needs only the method and query here.
    const request = { method, query } as NextApiRequest;
    // This test exercises session rejection and fresh authorization before multipart parsing.
    const context = { session: { $authorize: mocks.authorize } } as unknown as Ctx;
    await uploadFileRoute(request, spies.response, context);
    return spies;
}
beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("FILE_UPLOAD_PATH", "C:/cmdb-test-storage");
    const auth = { requireUser: () => auth, requirePermission: vi.fn() };
    mocks.loadAuthorization.mockResolvedValue(auth);
    mocks.authorize.mockImplementation(() => undefined);
    mocks.mkdtemp.mockImplementation(async (prefix: string) => prefix + "test");
    mocks.parse.mockResolvedValue([{ externalURI: ["https://example.com/song.wav"] }, {}]);
    mocks.upload.mockResolvedValue({ files: [], isSuccess: true });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("band-owned upload HTTP boundary", () => {
    it("requires authentication before consuming the request", async () => {
        mocks.authorize.mockImplementation(() => { throw new AuthenticationError(); });
        const result = await invoke();
        expect(result.status).toHaveBeenCalledWith(401);
        expect(mocks.loadAuthorization).not.toHaveBeenCalled(); expect(mocks.parse).not.toHaveBeenCalled();
    });
    it("requires fresh upload permission before staging or parsing", async () => {
        mocks.loadAuthorization.mockRejectedValue(new AuthorizationError());
        const result = await invoke();
        expect(result.status).toHaveBeenCalledWith(403);
        expect(mocks.mkdir).not.toHaveBeenCalled(); expect(mocks.parse).not.toHaveBeenCalled();
    });
    it.each(["GET", "HEAD", "PUT"])("rejects %s before authorization loading", async method => {
        const result = await invoke(method);
        expect(result.status).toHaveBeenCalledWith(405); expect(result.setHeader).toHaveBeenCalledWith("Allow", "POST");
        expect(mocks.loadAuthorization).not.toHaveBeenCalled();
    });
    it.each([{}, { bandPublicId: "invalid" }, { bandPublicId: [bandPublicId, bandPublicId] }])("rejects an absent or invalid band", async query => {
        expect((await invoke("POST", query)).status).toHaveBeenCalledWith(400);
        expect(mocks.mkdir).not.toHaveBeenCalled();
    });
    it("uses the selected band and cleans its owned staging directory", async () => {
        const result = await invoke();
        expect(config.api.bodyParser).toBe(false);
        expect(result.status).toHaveBeenCalledWith(200);
        expect(mocks.upload.mock.calls[0]?.[2]).toEqual({ bandPublicId, externalURI: "https://example.com/song.wav" });
        expect(mocks.rm).toHaveBeenCalledOnce(); expect(result.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    });
    it.each([
        { externalURI: ["https://example.com", "https://example.org"] },
        { bandPublicId: [bandPublicId] }, { bandId: ["1"] }, { storedLeafName: ["forged"] }, { taggedUserId: ["1"] },
        { taggedInstrumentId: ["1"] }, { externalURI: ["file:///secret"] },
    ])("rejects repeated, natural-ID or undeclared metadata fields", async fields => {
        mocks.parse.mockResolvedValue([fields, {}]);
        expect((await invoke()).status).toHaveBeenCalledWith(400);
        expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.rm).toHaveBeenCalledOnce();
    });
    it("maps parser limits and cleans temporary files", async () => {
        mocks.parse.mockRejectedValue(Object.assign(new Error("Too large"), { httpCode: 413 }));
        expect((await invoke()).status).toHaveBeenCalledWith(413);
        expect(mocks.rm).toHaveBeenCalledOnce(); expect(mocks.upload).not.toHaveBeenCalled();
    });
    it("cleans staging after a failed transactional upload", async () => {
        mocks.upload.mockRejectedValue(new Error("transaction failed"));
        expect((await invoke()).status).toHaveBeenCalledWith(500);
        expect(mocks.rm).toHaveBeenCalledOnce();
    });
    it("returns the same 404 for absent and inaccessible public references", async () => {
        mocks.upload.mockRejectedValue(new DB3PublicIdError("Song was not found."));
        expect((await invoke()).status).toHaveBeenCalledWith(404);
        expect(mocks.rm).toHaveBeenCalledOnce();
    });
});

describe("upload public contract and client transport", () => {
    it("requires a band and rejects natural references and server fields", () => {
        for (const input of [{}, { bandPublicId, taggedBandUserId: 1 }, { bandPublicId, sizeBytes: 1 },
            { bandPublicId, visiblePermission: "public", visiblePermissionId: "Permission000001" }]) {
            expect(FileUploadArgsSchema.safeParse(input).success).toBe(false);
        }
    });
    it.each([200, 403])("uses explicit band, CSRF and strict responses for status %s", async status => {
        const listeners = new Map<string, () => void>();
        const append = vi.fn(); const open = vi.fn(); const header = vi.fn(); const progress = vi.fn();
        vi.stubGlobal("FormData", class { append = append; });
        vi.stubGlobal("XMLHttpRequest", class {
            upload = { addEventListener: vi.fn() }; responseText = JSON.stringify({ files: [], isSuccess: status === 200, errorMessage: "Denied" });
            status = status; open = open; setRequestHeader = header;
            addEventListener(name: string, listener: () => void) { listeners.set(name, listener); }
            send() { listeners.get("load")?.(); }
        });
        const request = CMDBUploadFile({ bandPublicId, files: null,
            fields: { externalURI: "https://example.com/score.pdf", visiblePermissionId: undefined }, onProgress: progress });
        if (status === 200) { await expect(request).resolves.toMatchObject({ isSuccess: true }); }
        else { await expect(request).rejects.toThrow("Denied"); }
        expect(open).toHaveBeenCalledWith("POST", "/api/files/upload?bandPublicId=" + bandPublicId, true);
        expect(header).toHaveBeenCalledWith("anti-csrf", "test-csrf");
        expect(append).toHaveBeenCalledOnce();
    });
});
