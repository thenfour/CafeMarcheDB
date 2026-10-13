import type { BandHostingConfig } from "src/route/portalRouting";
import { AuthorizationError } from "blitz";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadLocaleAvailability } from "src/locale/server/localization";
import { authoredTranslationContext } from "src/locale/shared/authoredTranslations";
import { PublicFeedInputSchema, type PublicFeedInput } from "../shared/publicFeedInput";
import { eventPublicFeedView, frontpageGalleryFeedView } from "../shared/entities/event/publicFeedViews";
import { MakePublicFeedResponseSpec } from "../shared/publicFeedApi";
import { queryView } from "./db3QueryCore";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";

/** Events, Gallery source visibility, locales and current grants share one snapshot. */
export async function readPublicFeed(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: PublicFeedInput, options: { readonly baseURL: string; readonly hosting: BandHostingConfig },
) {
    const selection = PublicFeedInputSchema.parse(input);
    return executeDB3Read(database, authorization, async context => {
        const band = context.authorization.requireBand();
        if (band.publicId !== selection.bandPublicId) {
            throw new AuthorizationError();
        }
        const common = {
            filter: { items: [] },
            bandPublicId: selection.bandPublicId,
            cmdbQueryContext: "publicDataFeed"
        };
        const [events, gallery, availability] = await Promise.all([
            queryView({
                ...common,
                view: eventPublicFeedView
            },
                context.authorization,
                context),
            queryView({
                ...common,
                view: frontpageGalleryFeedView
            },
                context.authorization,
                context),
            loadLocaleAvailability(context.database, band.id),
        ]);
        return MakePublicFeedResponseSpec(events.items, gallery.items, {
            translations: authoredTranslationContext(selection, availability.band),
            bandPublicId: selection.bandPublicId,
            baseURL: options.baseURL,
            hosting: options.hosting,
        });
    });
}
