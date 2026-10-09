import type { GetServerSideProps } from "next";
import { NotFoundError } from "blitz";
import db from "db";
import { ZodError } from "zod";
import type { EnNlFr } from "shared/lang";
import { HostingMode } from "shared/brandConfigBase";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { CMPublicIndex } from "src/core/components/frontpage/CMFrontpage";
import { withMemberPresentation } from "src/core/components/user/bandMemberLinks";
import React from "react";
import { readPublicFeed } from "src/core/db3/server/publicFeed";
import { PublicFeedInputSchema, type PublicFeedInput } from "src/core/db3/shared/publicFeedInput";
import type { PublicFeedResponseSpec } from "src/core/db3/shared/publicTypes";
import { homepageDisplayLanguage } from "src/locale/shared/authoredTranslations";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { publicFeedBaseURL, publicHomepageSelection } from "src/server/publicHomepage";

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
        const presentation = publicHomepageSelection(pagePresentationInput(context.query, context.req.headers["accept-language"]));
        // Next's /fr and /nl URLs remain explicit preferences. The default prefix leaves browser order intact.
        presentation.routeLocale ??= context.locale !== context.defaultLocale ? context.locale ?? null : null;
        if (process.env.CMDB_HOSTING_MODE !== HostingMode.CafeMarche) {
            return { redirect: { destination: withMemberPresentation("/backstage", presentation), permanent: false } };
        }
        if (!presentation.bandPublicId) {
            return { notFound: true };
        }
        const selection = PublicFeedInputSchema.parse(presentation);
        const auth = await loadAuthorizationForUser(null, undefined, selection.bandPublicId);
        const publicFeed = await readPublicFeed(db, auth, selection, { baseURL: publicFeedBaseURL() });
        return { props: { publicFeed, selection, lang: homepageDisplayLanguage(selection) } };
    } catch (error) {
        if (error instanceof NotFoundError || error instanceof ZodError || error instanceof RangeError) {
            return { notFound: true };
        }
        throw error;
    }
};
