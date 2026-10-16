import { NotFoundError } from "blitz";
import db from "db";
import type { GetServerSideProps } from "next";
import type { EnNlFr } from "shared/lang";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { CMPublicIndex } from "src/core/components/frontpage/CMFrontpage";
import { readPublicFeed } from "src/core/db3/server/publicFeed";
import { PublicFeedInputSchema, type PublicFeedInput } from "src/core/db3/shared/publicFeedInput";
import type { PublicFeedResponseSpec } from "src/core/db3/shared/publicTypes";
import { homepageDisplayLanguage } from "src/locale/shared/authoredTranslations";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { deserializePortalPath, isTenant, portalHref } from "src/route/portalRouting";
import { withPortalRequest } from "src/route/server/portalRequest";
import { ZodError } from "zod";
import { serverGetBaseUrl } from "../route/server/portalConfig";

interface PublicIndexProps {
    publicFeed: PublicFeedResponseSpec;
    selection: PublicFeedInput;
    lang: EnNlFr;
}

export default function PublicIndex(props: PublicIndexProps) {
    return <CMPublicIndex {...props} />;
}

export const getServerSideProps: GetServerSideProps<PublicIndexProps> = async context => {
    context.res.setHeader("Cache-Control", "no-store");
    try {
        return await withPortalRequest(context.req, async ({ hosting, requestPath: portalSelection }) => {
            const presentation = pagePresentationInput(portalSelection, context.req.headers["accept-language"]);
            if (isTenant(hosting, "generic")) {
                return {
                    redirect: {
                        destination: portalHref("/backstage", presentation, hosting),
                        permanent: false
                    }
                };
            }
            if (!presentation.bandPublicId) {
                return { notFound: true };
            }
            const selection = PublicFeedInputSchema.parse(presentation);
            const auth = await loadAuthorizationForUser(null, undefined, selection.bandPublicId);
            const publicFeed = await readPublicFeed(db, auth, selection, { baseURL: serverGetBaseUrl(), hosting });
            return { props: { publicFeed, selection, lang: homepageDisplayLanguage(selection) } };
        }, deserializePortalPath(context.query));
    } catch (error) {
        if (error instanceof NotFoundError || error instanceof ZodError || error instanceof RangeError) {
            return { notFound: true };
        }
        throw error;
    }
};
