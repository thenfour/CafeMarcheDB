import { api } from "src/blitz-server";

export const config = { api: { bodyParser: false } };

// Reject before parsing input or reading accounts/content during recovery.
export default api(async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(503).end();
});

// MIGRATION_RESTORE: public-publication
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/api/public.ts:1-82
// Reason: Public homepage/feed and gallery editors still use unscoped content queries.
// Restore: Restore band-specific public homepage, agenda, galleries and feed delivery, including hosting modes, language selection, CORS, image editing and visibility with explicit public band routing and authorized reads/writes.
// Verification: Verify anonymous and member publication in two bands/locales, privacy, CORS/feed consumers, gallery ordering/images and built-browser homepage/editor workflows.
// SHA256: dffcf1c4d2e6274385fcf9e344b51ce16a4f38bb5ff0e3a06d7bbdab077e4a27
// MIGRATION_REFERENCE_BEGIN
// // server
// // http://192.168.1.2:10455/api/public
// // http://192.168.1.2:10455/api/public?lang=fr
//
// import { loadAuthorization } from "@/src/auth/server/serverAuthorization";
// // provide json feed of content for public homepage consumption.
//
// // input: lang
//
// import { xEvent } from "@/src/core/db3/db3";
// import { queryTable } from "@/src/core/db3/server/db3QueryCore";
// import { CMDBTableFilterModel } from "@/src/core/db3/shared/apiTypes";
// import { MakePublicFeedResponseSpec } from "@/src/core/db3/shared/publicFeedApi";
// import { Ctx } from "blitz";
// import { NextApiRequest, NextApiResponse } from "next";
// import { EnNlFr, ParseLanguageCode } from "shared/lang";
// import { api } from "src/blitz-server";
// import * as db3 from "src/core/db3/db3";
//
// async function handler(req: NextApiRequest, res: NextApiResponse, ctx: Ctx) {
//     const authorization = await loadAuthorization(ctx.session);
//
//     let langParam = req.query.lang;
//     if (Array.isArray(langParam)) {
//         // if multiple lang parameters are provided, take the first one
//         langParam = langParam[0];
//     }
//     const lang: EnNlFr = ParseLanguageCode(langParam);
//
//     const eventsFilterModel: CMDBTableFilterModel = {
//         items: [
//             {
//                 field: "frontpageVisible",
//                 operator: "equals",
//                 value: true
//             }
//         ],
//     };
//
//     const eventsCall = queryTable({
//         filter: eventsFilterModel,
//         cmdbQueryContext: "publicDataFeed",
//         table: {
//             tableID: xEvent.tableID,
//             tableName: xEvent.tableName,
//             viewID: db3.eventFrontpageView.viewID,
//         },
//         orderBy: undefined,
//     },
//         authorization);
//
//     const galleryCall = queryTable({
//         filter: { items: [] },
//         cmdbQueryContext: "publicDataFeed",
//         table: {
//             tableID: db3.xFrontpageGalleryItem.tableID,
//             tableName: db3.xFrontpageGalleryItem.tableName,
//             viewID: db3.frontpageGalleryFeedView.viewID,
//         },
//         orderBy: undefined,
//     },
//         authorization);
//
//     const [eventsResultRaw, galleryResultRaw] = await Promise.all([
//         eventsCall,
//         galleryCall,
//     ]);
//
//     const eventItems = eventsResultRaw.items as db3.EventFrontpageDBPayload[];
//     const galleryItems = galleryResultRaw.items as db3.FrontpageGalleryFeedDBPayload[];
//
//     const payload = MakePublicFeedResponseSpec(eventItems, lang, galleryItems);
//
//     // CORS
//     res.setHeader("Access-Control-Allow-Origin", "*");
//     res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
//     //res.setHeader("Access-Control-Allow-Headers", "Content-Type");
//
//     res.status(200).json(payload);
// }
//
// export default api(handler);
// MIGRATION_REFERENCE_END
