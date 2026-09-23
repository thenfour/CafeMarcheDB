// server

import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
// provide json feed of content for public homepage consumption.

// input: lang

import { xEvent } from "@/src/core/db3/db3";
import { queryTable } from "@/src/core/db3/server/db3QueryCore";
import { CMDBTableFilterModel } from "@/src/core/db3/shared/apiTypes";
import { MakePublicFeedResponseSpec } from "@/src/core/db3/shared/publicFeedApi";
import { Ctx } from "blitz";
import { NextApiRequest, NextApiResponse } from "next";
import { EnNlFr } from "shared/lang";
import { api } from "src/blitz-server";
import * as db3 from "src/core/db3/db3";

async function handler(req: NextApiRequest, res: NextApiResponse, ctx: Ctx) {
    const authorization = await getRequestAuthorization(ctx.session);
    const langParam = req.query.lang;
    const lang: EnNlFr = (langParam === "nl" ? "nl" : langParam === "fr" ? "fr" : "en");

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
        table: db3.xFrontpageGalleryItem,
        orderBy: undefined,
    },
        authorization);

    const [eventsResultRaw, galleryResultRaw] = await Promise.all([
        eventsCall,
        galleryCall,
    ]);

    const galleryResult: db3.FrontpageGalleryItemPayload[] = galleryResultRaw.items as db3.FrontpageGalleryItemPayload[];

    // empty reference store. hydration on eventFrontpageView shall not use references; all data should come from the prisma selection.
    const referenceStore = new db3.DB3ReferenceStore();

    const hydrated = eventsResultRaw.items.map(event => db3.eventFrontpageView.hydrate(
        db3.eventFrontpageView.parseDto(event),
        referenceStore,
    ));

    const payload = MakePublicFeedResponseSpec(hydrated, lang, galleryResult);

    res.status(200).json(payload);
}

export default api(handler);
