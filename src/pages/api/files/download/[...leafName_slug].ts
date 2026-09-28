import { Ctx } from "@blitzjs/next";
import { NextApiRequest, NextApiResponse } from "next";
import { api } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import {
    ServeAuthorizedFileDownload,
} from "src/core/db3/server/fileDownload";

export const downloadFileRoute = async (
    req: NextApiRequest,
    res: NextApiResponse,
    ctx: Ctx,
) => {
    const routeParts = req.query.leafName_slug;
    const storedLeafName = Array.isArray(routeParts) ? routeParts[0] : routeParts;
    if (!storedLeafName) {
        res.status(400).end();
        return;
    }

    await ServeAuthorizedFileDownload(req, res, await loadAuthorization(ctx.session), storedLeafName);
};

export default api(downloadFileRoute);
