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

    // empty reference store. hydration on eventFrontpageView shall not use references; all data should come from the prisma selection.
    const referenceStore = new db3.DB3ReferenceStore();

    const hydrated = eventsResultRaw.items.map(event => db3.eventFrontpageView.hydrate(
        db3.eventFrontpageView.parseDto(event),
        referenceStore,
    ));

    const galleryResult = galleryResultRaw.items.map(item => db3.frontpageGalleryFeedView.hydrate(
        db3.frontpageGalleryFeedView.parseDto(item),
        referenceStore,
    )).flatMap(item => {
        const file = item.file;
        if (item.sortOrder === undefined || item.caption === undefined
            || item.displayParams === undefined || !file
            || file.storedLeafName === undefined || file.customData === undefined
            || file.mimeType === undefined) return [];
        return [{
            publicId: item.publicId,
            sortOrder: item.sortOrder,
            caption: item.caption,
            displayParams: item.displayParams,
            file: {
                storedLeafName: file.storedLeafName,
                customData: file.customData,
                mimeType: file.mimeType,
            },
        }];
    });

    const payload = MakePublicFeedResponseSpec(hydrated, lang, galleryResult);

    res.status(200).json(payload);
}

export default api(handler);
