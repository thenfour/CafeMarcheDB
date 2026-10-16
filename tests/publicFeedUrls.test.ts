import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { authoredTranslationContext } from "src/locale/shared/authoredTranslations";
import type { BandHostingConfig } from "src/route/portalRouting";
import { frontpageGalleryFeedView } from "src/core/db3/shared/entities/event/publicFeedViews";
import { MakePublicFeedResponseSpec } from "src/core/db3/shared/publicFeedApi";
import { MakeDefaultImageEditParams } from "src/core/db3/shared/fileTypes";

const bandPublicId = parsePublicId<"Band">("FeedUrlBand00001");
const hostings: readonly BandHostingConfig[] = [{ kind: "multiBand" }, { kind: "singleBand", tenant: "generic" }];

describe("public feed resource URLs", () => {
    it.each(hostings)("keeps gallery downloads in the API namespace with an explicit band on $kind", hosting => {
        const photo = frontpageGalleryFeedView.parseDto({
            publicId: "FeedGallery00001", sortOrder: 0,
            caption: "Photo", caption_fr: null, caption_nl: null,
            displayParams: JSON.stringify(MakeDefaultImageEditParams()),
            file: { publicId: "File000000000001", storedLeafName: "image.png", customData: null, mimeType: "image/png" },
        });
        const feed = MakePublicFeedResponseSpec([], [photo], {
            hosting, bandPublicId, baseURL: "https://publication.test",
            translations: authoredTranslationContext({ routeLocale: "fr-BE" }, ["en-US", "fr-BE"]),
        });
        expect(feed.gallery[0]?.imageFileUri).toBe(`https://publication.test/fr-BE/api/files/download/image.png?bandPublicId=${bandPublicId}`);
    });
});
