// server
// http://192.168.1.2:10455/api/public
// http://192.168.1.2:10455/api/public?lang=fr

import { loadAuthorization } from "@/src/auth/server/serverAuthorization";
// provide json feed of content for public homepage consumption.

// input: lang

import { xEvent } from "@/src/core/db3/db3";
import { queryTable } from "@/src/core/db3/server/db3QueryCore";
import { CMDBTableFilterModel } from "@/src/core/db3/shared/apiTypes";
import { MakePublicFeedResponseSpec } from "@/src/core/db3/shared/publicFeedApi";
import { Ctx } from "blitz";
import { NextApiRequest, NextApiResponse } from "next";
import { EnNlFr, ParseLanguageCode } from "shared/lang";
import { api } from "src/blitz-server";
import * as db3 from "src/core/db3/db3";

async function handler(req: NextApiRequest, res: NextApiResponse, ctx: Ctx) {
    const authorization = await loadAuthorization(ctx.session);

    let langParam = req.query.lang;
    if (Array.isArray(langParam)) {
        // if multiple lang parameters are provided, take the first one
        langParam = langParam[0];
    }
    const lang: EnNlFr = ParseLanguageCode(langParam);

    const eventsFilterModel: CMDBTableFilterModel = {
        items: [
            {
                field: "frontpageVisible",
                operator: "equals",
                value: true
            }
        ],
    };

    const eventsCall = queryTable({
        filter: eventsFilterModel,
        cmdbQueryContext: "publicDataFeed",
        table: {
            tableID: xEvent.tableID,
            tableName: xEvent.tableName,
            viewID: db3.eventFrontpageView.viewID,
        },
        orderBy: undefined,
    },
        authorization);

    const galleryCall = queryTable({
        filter: { items: [] },
        cmdbQueryContext: "publicDataFeed",
        table: {
            tableID: db3.xFrontpageGalleryItem.tableID,
            tableName: db3.xFrontpageGalleryItem.tableName,
            viewID: db3.frontpageGalleryFeedView.viewID,
        },
        orderBy: undefined,
    },
        authorization);

    const [eventsResultRaw, galleryResultRaw] = await Promise.all([
        eventsCall,
        galleryCall,
    ]);

    const eventItems = eventsResultRaw.items as db3.EventFrontpageDBPayload[];
    const galleryItems = galleryResultRaw.items as db3.FrontpageGalleryFeedDBPayload[];

    const payload = MakePublicFeedResponseSpec(eventItems, lang, galleryItems);

    res.status(200).json(payload);
}

export default api(handler);
