import { HostingMode } from "shared/brandConfigBase";
import { NotFoundError } from "blitz";
import { BandPublicIdSchema, type PresentationInput } from "src/locale/shared/presentationInput";

export function publicFeedBaseURL(): string {
    const configured = process.env.CMDB_BASE_URL;
    if (!configured) {
        throw new Error("Public publication requires CMDB_BASE_URL.");
    }
    try {
        const url = new URL(configured);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
            throw new Error("Invalid public base URL.");
        }
    } catch {
        throw new Error("CMDB_BASE_URL must be an HTTP(S) public URL without credentials.");
    }
    return configured;
}

/** A trusted host configuration binds the familiar root URL; never infer a band from database order. */
export function publicHomepageSelection(input: PresentationInput): PresentationInput {
    if (input.bandPublicId || process.env.CMDB_HOSTING_MODE !== HostingMode.CafeMarche) {
        return input;
    }
    const configuredBand = process.env.CMDB_PUBLIC_BAND_PUBLIC_ID;
    if (!configuredBand) {
        throw new NotFoundError();
    }
    return {
        ...input,
        bandPublicId: BandPublicIdSchema.parse(configuredBand)
    };
}
