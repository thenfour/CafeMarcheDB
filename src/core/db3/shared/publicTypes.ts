import { ImageEditParams } from "./fileTypes";

export interface PublicAgendaItemSpec {
    date?: string | null;
    time?: string | null;
    title?: string | null;
    detailsMarkdown?: string | null;
    location?: string | null;
    locationURI?: string | null;
    tags?: string | null;

    id: number;
    startsAt: Date | null;
};
export interface PublicGalleryItemSpec {
    id: number;
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
