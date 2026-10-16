import { Ctx } from "@blitzjs/next";
import { NextApiRequest, NextApiResponse } from "next";
import { api } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { AuthenticationError, AuthorizationError } from "blitz";
import { isPublicId, parsePublicId } from "shared/publicId";
import {
    ServeAuthorizedFileDownload,
} from "src/core/db3/server/fileDownload";

export const downloadFileRoute = async (
    req: NextApiRequest,
    res: NextApiResponse,
    ctx: Ctx,
) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        res.status(405).end();
        return;
    }
    const routeParts = req.query.leafName_slug;
    const storedLeafName = Array.isArray(routeParts) ? routeParts[0] : routeParts;
    if (!storedLeafName) {
        res.status(400).end();
        return;
    }

    const selectedBand = req.query.bandPublicId;
    if (!isPublicId(selectedBand)) {
        res.status(404).end();
        return;
    }
    const bandPublicId = parsePublicId<"Band">(selectedBand);
    try {
        await ServeAuthorizedFileDownload(req, res, await loadAuthorization(ctx.session, bandPublicId), storedLeafName);
    } catch (error) {
        if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
            res.status(404).end();
            return;
        }
        throw error;
    }
};

export default api(downloadFileRoute);
