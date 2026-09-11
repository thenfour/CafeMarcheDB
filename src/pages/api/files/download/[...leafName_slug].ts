import { Ctx } from "@blitzjs/next";
import { NextApiRequest, NextApiResponse } from "next";
import { api } from "src/blitz-server";
import {
    GetAuthorizedDirectDownloadFile,
    SendFileDownload,
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

    const file = await GetAuthorizedDirectDownloadFile(storedLeafName, ctx);
    if (!file) {
        // Use the same response for absent and unauthorized files so this route
        // does not disclose whether a storage identifier exists.
        res.status(404).end();
        return;
    }

    await SendFileDownload(req, res, file);
};

export default api(downloadFileRoute);
