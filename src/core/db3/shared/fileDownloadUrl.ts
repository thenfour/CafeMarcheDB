import type { BandPublicId } from "shared/publicId";

/** Stored Markdown paths acquire their explicit download input when rendered. */
export function fileDownloadHref(internalHref: string, bandPublicId: BandPublicId): string {
    const url = new URL(internalHref, "https://cmdb.invalid");
    url.searchParams.set("bandPublicId", bandPublicId);
    return `${url.pathname}${url.search}${url.hash}`;
}
