import { EnNlFr, LangSelectString } from "@/shared/lang";
import { Prisma } from "db";
import * as db3 from "../db3";
import { sortEvents } from "./apiTypes";
import { PublicAgendaItemSpec, PublicFeedResponseSpec, PublicGalleryItemSpec } from "./publicTypes";
import { SharedAPI } from "./sharedAPI";

// null-or-whitespace values in EN will not show the field
// null-or-whitespace values in NL and FR fallback to english
type AgendaItemSource = Pick<db3.EventFrontpageClient,
    | "publicId"
    | "dateRange"
    | "frontpageDate"
    | "frontpageDate_nl"
    | "frontpageDate_fr"
    | "frontpageTime"
    | "frontpageTime_nl"
    | "frontpageTime_fr"
    | "frontpageDetails"
    | "frontpageDetails_nl"
    | "frontpageDetails_fr"
    | "frontpageLocation"
    | "frontpageLocation_nl"
    | "frontpageLocation_fr"
    | "frontpageLocationURI"
    | "frontpageLocationURI_nl"
    | "frontpageLocationURI_fr"
    | "frontpageTags"
    | "frontpageTags_nl"
    | "frontpageTags_fr"
    | "frontpageTitle"
    | "frontpageTitle_nl"
    | "frontpageTitle_fr"
>;

export function getAgendaItem(event: AgendaItemSource, lang: EnNlFr): PublicAgendaItemSpec {
    const ret: PublicAgendaItemSpec = {
        id: event.publicId,
        startsAt: event.dateRange?.getStartDateTime() || null,
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

type PrismaFrontpageGalleryItemWithFile = Prisma.FrontpageGalleryItemGetPayload<{
    select: {
        id: true;
        sortOrder: true;
        caption: true;
        displayParams: true;
        file: {
            select: {
                storedLeafName: true;
                customData: true;
                mimeType: true;
            }
        }
    }
}>;

function convertGalleryItem(item: PrismaFrontpageGalleryItemWithFile): PublicGalleryItemSpec {
    return {
        id: item.id,
        sortOrder: item.sortOrder,
        caption: item.caption,
        imageFileUri: SharedAPI.files.getURIForFile(item.file),
        storedLeafName: item.file.storedLeafName,
        editParams: SharedAPI.files.getGalleryItemDisplayParams(item),
        customData: item.file.customData,
        displayParams: item.displayParams,
        mimeType: item.file.mimeType,
    };
};

export function MakePublicFeedResponseSpec(events: db3.EventFrontpageClient[], lang: EnNlFr, gallery: PrismaFrontpageGalleryItemWithFile[]): PublicFeedResponseSpec {
    const agenda: PublicAgendaItemSpec[] = events.map(e => getAgendaItem(e, lang));
    const sortedAgenda = sortEvents(agenda);
    const publicGallery: PublicGalleryItemSpec[] = gallery.map(g => convertGalleryItem(g));
    // sort by sortorder
    publicGallery.sort((a, b) => a.sortOrder - b.sortOrder);
    return {
        agenda: sortedAgenda,
        gallery: publicGallery,
    };
}
