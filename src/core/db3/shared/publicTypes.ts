import { ImageEditParams } from "./fileTypes";
import type { EventPublicId, FilePublicId, FrontpageGalleryItemPublicId } from "shared/publicId";

// these are the OUTPUT types
// which are  very close to the database payloads

export interface PublicAgendaItemSpec {
    date?: string | null;
    time?: string | null;
    title?: string | null;
    detailsMarkdown?: string | null;
    location?: string | null;
    locationURI?: string | null;
    tags?: string | null;

    id: EventPublicId;

    // sortable date; null = TBD
    startsAt: number | null;
};
export interface PublicGalleryItemSpec {
    galleryItemId: FrontpageGalleryItemPublicId;
    fileId: FilePublicId;
    sortOrder: number;
    caption: string | null;
    imageFileUri: string;
    storedLeafName: string;
    editParams: ImageEditParams | null;
    customData: string | null;
    displayParams: string;
    mimeType: string | null;
}
export interface PublicFeedResponseSpec {
    agenda: PublicAgendaItemSpec[];
    gallery: PublicGalleryItemSpec[];
};
