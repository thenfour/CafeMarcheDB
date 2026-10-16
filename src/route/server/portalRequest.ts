import { NotFoundError } from "blitz";
import db from "db";
import type { IncomingMessage } from "node:http";
import type { ParsedUrlQuery } from "querystring";
import { parsePublicId } from "shared/publicId";
import { withAuthorizationBandScope } from "src/auth/server/requestAuthorizationScope";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { deserializePortalPath, getServerBandHostingConfig, PORTAL_PATH_QUERY_PARAM, type BandHostingConfig, type PortalPath } from "../portalRouting";
import { serverGetBaseUrl } from "./portalConfig";

export type PortalBandDatabase = Pick<typeof db, "band">;

export interface PortalRequest {
    readonly hosting: BandHostingConfig;
    readonly requestPath: PortalPath;
}

type PortalIncomingRequest = Pick<IncomingMessage, "url" | "headers"> & { readonly query?: ParsedUrlQuery };
const requests = new WeakMap<PortalIncomingRequest, Promise<PortalRequest>>();

/** Resolve the parameter omitted by single-band URLs, without reparsing the path. */
export async function resolvePortalPath(path: PortalPath, hosting: BandHostingConfig, database: PortalBandDatabase = db): Promise<PortalPath> {
    if (!path.hasBandPrefix) {
        if (path.bandPublicId !== null) {
            throw new NotFoundError();
        }
        return path;
    }
    if (hosting.kind === "multiBand") {
        if (!path.bandPublicId) {
            throw new NotFoundError();
        }
        return path;
    }
    // todo: consider caching this.
    const bands = await database.band.findMany({ select: { publicId: true }, take: 2 });
    if (bands.length !== 1) {
        throw new Error("Single-band hosting requires exactly one Band in the database.");
    }
    const bandPublicId = bands[0]!.publicId;
    if (path.bandPublicId !== null && path.bandPublicId !== bandPublicId) {
        throw new NotFoundError();
    }
    return { ...path, bandPublicId: parsePublicId<"Band">(bandPublicId) };
}

function requestPortalPath(request: PortalIncomingRequest): PortalPath {
    if (request.query) {
        return deserializePortalPath(request.query);
    }
    const url = new URL(request.url ?? "/", serverGetBaseUrl());
    const values = url.searchParams.getAll(PORTAL_PATH_QUERY_PARAM);
    return deserializePortalPath({ [PORTAL_PATH_QUERY_PARAM]: values.length === 1 ? values[0] : values });
}

/** Adapters may already have deserialized Next's query; reuse that value and this request's resolution. */
export function resolvePortalRequestContext(request: PortalIncomingRequest, path?: PortalPath): Promise<PortalRequest> {
    const existing = requests.get(request);
    if (existing) {
        return existing;
    }
    const pending = (async () => {
        const hosting = getServerBandHostingConfig();
        const requestPath = await resolvePortalPath(path ?? requestPortalPath(request), hosting);
        return { hosting, requestPath };
    })().catch(error => {
        if (error instanceof RangeError) {
            throw new NotFoundError();
        }
        throw error;
    });
    requests.set(request, pending);
    return pending;
}

export async function resolvePagePresentationInput(request: PortalIncomingRequest, query: ParsedUrlQuery) {
    const portal = await resolvePortalRequestContext(request, deserializePortalPath(query));
    return pagePresentationInput(portal.requestPath, request.headers["accept-language"]);
}

export async function withPortalRequest<T>(request: PortalIncomingRequest, operation: (portal: PortalRequest) => Promise<T>, path?: PortalPath): Promise<T> {
    const portal = await resolvePortalRequestContext(request, path);
    return withAuthorizationBandScope(portal.requestPath.bandPublicId, () => operation(portal));
}
