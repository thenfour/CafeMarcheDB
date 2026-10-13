import type { BandPublicId } from "shared/publicId";
import { portalHref, type BandHostingConfig } from "src/route/portalRouting";
import { resolveAuthoredTranslations, type AuthoredTranslationContext } from "src/locale/shared/authoredTranslations";
import * as db3 from "../db3";
import { sortEventsRaw } from "./apiTypes";
import { PublicAgendaItemSpec, PublicFeedResponseSpec, PublicGalleryItemSpec } from "./publicTypes";
import { SharedAPI } from "./sharedAPI";

// The same authored fields supply the public feed and the Event editor preview.
type AgendaItem = Pick<db3.EventPublicFeedDto,
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


export function getAgendaItem(event: AgendaItem, context: AuthoredTranslationContext): PublicAgendaItemSpec {
    const ret: PublicAgendaItemSpec = {
        id: db3.xEvent.parseIdentity(event.publicId), // useful for debugging / "which event is this"
        startsAt: event.startsAt?.valueOf() ?? null,
        date: resolveAuthoredTranslations({ en: event.frontpageDate, nl: event.frontpageDate_nl, fr: event.frontpageDate_fr }, context) ?? "",
        time: resolveAuthoredTranslations({ en: event.frontpageTime, nl: event.frontpageTime_nl, fr: event.frontpageTime_fr }, context) ?? "",
        detailsMarkdown: resolveAuthoredTranslations({ en: event.frontpageDetails, nl: event.frontpageDetails_nl, fr: event.frontpageDetails_fr }, context) ?? "",
        location: resolveAuthoredTranslations({ en: event.frontpageLocation, nl: event.frontpageLocation_nl, fr: event.frontpageLocation_fr }, context) ?? "",
        locationURI: resolveAuthoredTranslations({ en: event.frontpageLocationURI, nl: event.frontpageLocationURI_nl, fr: event.frontpageLocationURI_fr }, context) ?? "",
        tags: resolveAuthoredTranslations({ en: event.frontpageTags, nl: event.frontpageTags_nl, fr: event.frontpageTags_fr }, context) ?? "",
        title: resolveAuthoredTranslations({ en: event.frontpageTitle, nl: event.frontpageTitle_nl, fr: event.frontpageTitle_fr }, context) ?? "",
    }
    return ret;
}

export interface PublicFeedConversionContext {
    readonly hosting: BandHostingConfig;
    readonly translations: AuthoredTranslationContext;
    readonly bandPublicId: BandPublicId;
    readonly baseURL: string;
}

function convertGalleryItem(item: db3.FrontpageGalleryFeedDto, context: PublicFeedConversionContext): PublicGalleryItemSpec | null {
    const file = item.file;
    // DB3 DTOs omit unauthorized fields. A photo needs its complete authorized display and source metadata.
    if (!file || file.storedLeafName === undefined || file.customData === undefined || file.mimeType === undefined
        || item.sortOrder === undefined || item.displayParams === undefined) {
        return null;
    }
    const fileUrl = new URL(portalHref(SharedAPI.files.getURIForFile({ storedLeafName: file.storedLeafName }), {
        bandPublicId: context.bandPublicId,
        routeLocale: context.translations.preferences.routeLocale,
    }, context.hosting), context.baseURL).href;
    return {
        galleryItemId: db3.xFrontpageGalleryItem.parseIdentity(item.publicId),
        fileId: db3.xFile.parseIdentity(file.publicId),
        sortOrder: item.sortOrder,
        caption: resolveAuthoredTranslations({ en: item.caption, nl: item.caption_nl, fr: item.caption_fr }, context.translations),
        imageFileUri: fileUrl,
        storedLeafName: file.storedLeafName,
        editParams: SharedAPI.files.getGalleryItemDisplayParams({ displayParams: item.displayParams }),
        customData: file.customData,
        displayParams: item.displayParams,
        mimeType: file.mimeType,
    };
}

export function MakePublicFeedResponseSpec(
    events: readonly AgendaItem[],
    gallery: readonly db3.FrontpageGalleryFeedDto[],
    context: PublicFeedConversionContext,
): PublicFeedResponseSpec {
    const agenda = sortEventsRaw(events.map(event => getAgendaItem(event, context.translations)));
    const publicGallery = gallery.flatMap(item => {
        const photo = convertGalleryItem(item, context);
        return photo ? [photo] : [];
    });
    publicGallery.sort((a, b) => a.sortOrder - b.sortOrder || (a.galleryItemId < b.galleryItemId ? -1 : a.galleryItemId > b.galleryItemId ? 1 : 0));
    return { agenda, gallery: publicGallery };
}
