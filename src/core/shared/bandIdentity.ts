import type { BandPublicId } from "shared/publicId";

/** Public presentation data for a band, independent of navigation and membership rules. */
export interface BandIdentity {
    readonly publicId: BandPublicId;
    readonly name: string | null;
    readonly logoUrl: string;
    readonly theme: {
        readonly primaryMain: string;
        readonly secondaryMain: string;
        readonly contrastText: string;
    };
}
