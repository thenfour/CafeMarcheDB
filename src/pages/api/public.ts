import { applicationQuery, getServerBandHostingConfig } from "@/src/route/portalRouting";
import { serverGetBaseUrl } from "@/src/route/server/portalConfig";
import { AuthorizationError, NotFoundError, type Ctx } from "blitz";
import db from "db";
import type { NextApiRequest, NextApiResponse } from "next";
import { loadAuthorization, loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { getSessionForRequest } from "src/blitz-server";
import { readPublicFeed } from "src/core/db3/server/publicFeed";
import { PublicFeedInputSchema } from "src/core/db3/shared/publicFeedInput";
import { collectLocalePreferences, parseAcceptLanguage } from "src/locale/shared/localePreferences";
import { withPortalRequest } from "src/route/server/portalRequest";
import { z, ZodError } from "zod";

export const config = { api: { bodyParser: false } };
const PublicFeedQuerySchema = PublicFeedInputSchema.omit({ browserLanguages: true })
    // lang remains the standalone homepage's public spelling for an explicit locale preference.
    .extend({ lang: z.string().max(128).optional() })
    .refine(input => !(input.lang && input.routeLocale), "Supply either lang or routeLocale");

function isCrossOrigin(req: NextApiRequest, baseURL: string): boolean {
    return req.headers.origin !== undefined && req.headers.origin !== new URL(baseURL).origin;
}

export async function publicFeedHandler(req: NextApiRequest, res: NextApiResponse, ctx?: Pick<Ctx, "session">) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET,HEAD,OPTIONS");
        res.status(405).end();
        return;
    }
    try {
        const query = PublicFeedQuerySchema.parse(applicationQuery(req.query));
        const input = PublicFeedInputSchema.parse({
            bandPublicId: query.bandPublicId,
            routeLocale: query.routeLocale ?? query.lang,
            browserLanguages: parseAcceptLanguage(req.headers["accept-language"]).slice(0, 32),
        });
        collectLocalePreferences(input); // Validate explicit tags before loading accounts or content.
        const baseURL = serverGetBaseUrl();
        const auth = isCrossOrigin(req, baseURL)
            ? await loadAuthorizationForUser(null, undefined, input.bandPublicId)
            : await loadAuthorization(ctx?.session ?? await getSessionForRequest(req, res), input.bandPublicId);
        const payload = await readPublicFeed(db, auth, input, { baseURL, hosting: getServerBandHostingConfig() });
        if (req.method === "HEAD") {
            res.status(200).end();
            return;
        }
        res.status(200).json(payload);
    } catch (error) {
        if (error instanceof ZodError || error instanceof RangeError) {
            res.status(400).end();
            return;
        }
        if (error instanceof NotFoundError) {
            res.status(404).end();
            return;
        }
        if (error instanceof AuthorizationError) {
            res.status(403).end();
            return;
        }
        throw error;
    }
}

// A read-only Next route rejects methods before session/CSRF middleware; accepted GETs use the shared session owner.
export default async function portalPublicFeedHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        return publicFeedHandler(req, res);
    }
    try {
        await withPortalRequest(req, () => publicFeedHandler(req, res));
    } catch (error) {
        if (error instanceof NotFoundError) {
            res.setHeader("Cache-Control", "no-store");
            res.status(404).end();
            return;
        }
        throw error;
    }
}
