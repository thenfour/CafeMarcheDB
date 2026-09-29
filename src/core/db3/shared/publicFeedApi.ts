import { EnNlFr, LangSelectString } from "@/shared/lang";
import { ServerApi } from "@/src/server/serverApi";
import * as db3 from "../db3";
import { sortEventsRaw } from "./apiTypes";
import { PublicAgendaItemSpec, PublicFeedResponseSpec, PublicGalleryItemSpec } from "./publicTypes";
import { SharedAPI } from "./sharedAPI";

// this is called by both server & client code.
// server has things like database IDs
// client has public IDs and public foreign payloads.
// Q: why can't we just use the client shape? because we haven't migrated the server code to query the view in a hydrated way.
type AgendaItem = Pick<db3.EventFrontpageDBPayload,
    "publicId" |
    "startsAt" |
    "frontpageDate" |
    "frontpageDate_nl" |
    "frontpageDate_fr" |
    "frontpageTime" |
    "frontpageTime_nl" |
    "frontpageTime_fr" |
    "frontpageDetails" |
    "frontpageDetails_nl" |
    "frontpageDetails_fr" |
    "frontpageLocation" |
    "frontpageLocation_nl" |
    "frontpageLocation_fr" |
    "frontpageLocationURI" |
    "frontpageLocationURI_nl" |
    "frontpageLocationURI_fr" |
    "frontpageTags" |
    "frontpageTags_nl" |
    "frontpageTags_fr" |
    "frontpageTitle" |
    "frontpageTitle_nl" |
    "frontpageTitle_fr"
>;


export function getAgendaItem(event: AgendaItem, lang: EnNlFr): PublicAgendaItemSpec {
    const ret: PublicAgendaItemSpec = {
        id: db3.xEvent.parseIdentity(event.publicId), // useful for debugging / "which event is this"
        startsAt: event.startsAt?.valueOf() || null,
        date: LangSelectString(lang, event.frontpageDate, event.frontpageDate_nl, event.frontpageDate_fr) || "",
        time: LangSelectString(lang, event.frontpageTime, event.frontpageTime_nl, event.frontpageTime_fr) || "",
        detailsMarkdown: LangSelectString(lang, event.frontpageDetails, event.frontpageDetails_nl, event.frontpageDetails_fr) || "",
        location: LangSelectString(lang, event.frontpageLocation, event.frontpageLocation_nl, event.frontpageLocation_fr) || "",
        locationURI: LangSelectString(lang, event.frontpageLocationURI, event.frontpageLocationURI_nl, event.frontpageLocationURI_fr) || "",
        tags: LangSelectString(lang, event.frontpageTags, event.frontpageTags_nl, event.frontpageTags_fr) || "",
        title: LangSelectString(lang, event.frontpageTitle, event.frontpageTitle_nl, event.frontpageTitle_fr) || "",
    }
    return ret;
}

function convertGalleryItem(item: db3.FrontpageGalleryFeedDBPayload, lang: EnNlFr): PublicGalleryItemSpec {
    const fileUrl = ServerApi.getAbsoluteUri(SharedAPI.files.getURIForFile(item.file));
    return {
        galleryItemId: db3.xFrontpageGalleryItem.parseIdentity(item.publicId),
        fileId: db3.xFile.parseIdentity(item.file.publicId),
        sortOrder: item.sortOrder,
        caption: LangSelectString(lang, item.caption, item.caption_nl, item.caption_fr) || "",
        imageFileUri: fileUrl,
        storedLeafName: item.file.storedLeafName,
        editParams: SharedAPI.files.getGalleryItemDisplayParams(item),
        customData: item.file.customData,
        displayParams: item.displayParams,
        mimeType: item.file.mimeType,
    };
};

export function MakePublicFeedResponseSpec(
    events: db3.EventFrontpageDBPayload[],
    lang: EnNlFr,
    gallery: db3.FrontpageGalleryFeedDBPayload[]):
    PublicFeedResponseSpec //
{
    const agenda: PublicAgendaItemSpec[] = events.map(e => getAgendaItem(e, lang));
    const sortedAgenda = sortEventsRaw(agenda);

    const publicGallery: PublicGalleryItemSpec[] = gallery.map(g => convertGalleryItem(g, lang));
    publicGallery.sort((a, b) => a.sortOrder - b.sortOrder);

    return {
        agenda: sortedAgenda,
        gallery: publicGallery,
    };
}
