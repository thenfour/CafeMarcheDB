// provide json feed of content for public homepage consumption.

// input: lang

import { xEvent } from "@/src/core/db3/db3";
import { DB3QueryCore2 } from "@/src/core/db3/server/db3QueryCore";
import { CMDBTableFilterModel } from "@/src/core/db3/shared/apiTypes";
import { NextApiRequest, NextApiResponse } from "next";
import { EnNlFr } from "shared/lang";
import * as db3 from "src/core/db3/db3";
import { MakePublicFeedResponseSpec } from "src/core/db3/shared/publicTypes";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const langParam = req.query.lang;
    const lang: EnNlFr = (langParam === "nl" ? "nl" : langParam === "fr" ? "fr" : "en");

    const clientIntention = { intention: "public", mode: "primary" } as const;

    const eventsFilterModel: CMDBTableFilterModel = {
        items: [
            {
                field: "frontpageVisible",
                operator: "equals",
                value: true
            }
        ],
    };

    const eventsCall = DB3QueryCore2({
        filter: eventsFilterModel,
        clientIntention,
        cmdbQueryContext: "publicDataFeed",
        tableID: xEvent.tableID,
        tableName: xEvent.tableName,
        orderBy: undefined,
    },
        null /* no session; no user */);


    const galleryCall = DB3QueryCore2({
        filter: { items: [] },
        clientIntention,
        cmdbQueryContext: "publicDataFeed",
        tableID: db3.xFrontpageGalleryItem.tableID,
        tableName: db3.xFrontpageGalleryItem.tableName,
        orderBy: undefined,
    },
        null /* no session; no user */);

    const [eventsResultRaw, galleryResultRaw] = await Promise.all([
        eventsCall,
        galleryCall,
    ]);

    const eventsResult: db3.EventWithTagsPayload[] = eventsResultRaw.items as db3.EventWithTagsPayload[];
    const galleryResult: db3.FrontpageGalleryItemPayload[] = galleryResultRaw.items as db3.FrontpageGalleryItemPayload[];

    const payload = MakePublicFeedResponseSpec(eventsResult, lang, galleryResult);

    // // trim down events to agenda items
    // const agenda: PublicAgendaItemSpec[] = eventsResult.map(e => getAgendaItem(e, lang));
    // const sortedAgenda = sortEvents(agenda);

    // // handle gallery
    // const publicGallery: PublicGalleryItemSpec[] = galleryResult.map(g => convertGalleryItem(g));
    // // sort by sortorder
    // publicGallery.sort((a, b) => a.sortOrder - b.sortOrder);

    // const payload: PublicFeedResponseSpec = {
    //     agenda: sortedAgenda,
    //     gallery: publicGallery,
    // };

    res.status(200).json(payload);
}
