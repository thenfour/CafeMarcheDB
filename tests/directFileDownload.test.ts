import { AuthenticationError, AuthorizationError } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";

interface DownloadRequest {
    method: string;
    query: { bandPublicId?: string | string[]; leafName_slug?: string | string[] };
}
interface DownloadResponse {
    status: (code: number) => DownloadResponse;
    end: () => void;
    setHeader: (name: string, value: string) => void;
}
type DownloadHandler = (request: DownloadRequest, response: DownloadResponse, context: { session: object }) => Promise<void>;
const endpoint = vi.hoisted(() => {
    const state: { handler?: DownloadHandler } = {};
    return state;
});
vi.mock("src/blitz-server", () => ({ api: (handler: DownloadHandler) => {
    endpoint.handler = handler;
    return handler;
} }));
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), serve: vi.fn() }));
vi.mock("src/auth/server/serverAuthorization", () => ({ loadAuthorization: mocks.authorize }));
vi.mock("src/core/db3/server/fileDownload", () => ({ ServeAuthorizedFileDownload: mocks.serve }));
import "src/pages/api/files/download/[...leafName_slug]";

const bandPublicId = parsePublicId<"Band">("DownloadBand0001");
const session = {};
const authorization = {};
function responseSpies() {
    const status = vi.fn();
    const end = vi.fn();
    const setHeader = vi.fn();
    const response: DownloadResponse = {
        status: code => {
            status(code);
            return response;
        },
        end, setHeader,
    };
    return { response, status, end, setHeader };
}
async function invoke(request: DownloadRequest, response: DownloadResponse) {
    if (!endpoint.handler) {
        throw new Error("Download route did not initialize.");
    }
    await endpoint.handler(request, response, { session });
}
beforeEach(() => {
    vi.resetAllMocks();
    mocks.authorize.mockResolvedValue(authorization);
    mocks.serve.mockResolvedValue(undefined);
});

describe("direct band file download HTTP boundary", () => {
    it.each([undefined, "bad", [bandPublicId], [bandPublicId, bandPublicId]])("returns 404 for invalid context %j before authorization or file lookup", async selection => {
        const spies = responseSpies();
        await invoke({ method: "GET", query: { bandPublicId: selection, leafName_slug: ["score.svg", "title"] } }, spies.response);
        expect(spies.status).toHaveBeenCalledWith(404);
        expect(mocks.authorize).not.toHaveBeenCalled();
        expect(mocks.serve).not.toHaveBeenCalled();
    });
    it.each(["GET", "HEAD"])("forwards explicit context, the stored leaf and the original %s request", async method => {
        const spies = responseSpies();
        const request = { method, query: { bandPublicId, leafName_slug: ["score.svg", "display-title"] } };
        await invoke(request, spies.response);
        expect(mocks.authorize).toHaveBeenCalledWith(session, bandPublicId);
        expect(mocks.serve).toHaveBeenCalledWith(request, spies.response, authorization, "score.svg");
    });
    it.each([new AuthenticationError(), new AuthorizationError()])("conceals unavailable context as 404", async error => {
        mocks.authorize.mockRejectedValue(error);
        const spies = responseSpies();
        await invoke({ method: "GET", query: { bandPublicId, leafName_slug: "score.svg" } }, spies.response);
        expect(spies.status).toHaveBeenCalledWith(404);
        expect(mocks.serve).not.toHaveBeenCalled();
    });
    it("rejects write methods before authorization and advertises supported methods", async () => {
        const spies = responseSpies();
        await invoke({ method: "POST", query: { bandPublicId, leafName_slug: "score.svg" } }, spies.response);
        expect(spies.status).toHaveBeenCalledWith(405);
        expect(spies.setHeader).toHaveBeenCalledWith("Allow", "GET, HEAD");
        expect(mocks.authorize).not.toHaveBeenCalled();
    });
});
