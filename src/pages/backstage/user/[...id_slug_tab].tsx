import React, { Suspense } from "react";
import type { BlitzPage } from "@blitzjs/next";
import type { UserPublicId } from "shared/publicId";
import { gSSP } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "src/core/components/dashboard/StaticMenuItems";
import { BandMemberProfile } from "src/core/components/user/BandMemberProfile";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { bandUserProfileView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { xUserMinimum } from "src/core/db3/shared/schema/user";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { useLocale } from "src/locale/components/useLocale";

interface PageProps { readonly personId: UserPublicId }

export const getServerSideProps = gSSP<PageProps>(async ({ params, query, req, ctx }) => {
    const path = params?.id_slug_tab;
    const identity = Array.isArray(path) ? path[0] : undefined;
    const input = pagePresentationInput(query, req.headers["accept-language"]);
    if (!xUserMinimum.isIdentity(identity) || !input.bandPublicId) {
        return { notFound: true };
    }
    const personId = xUserMinimum.parseIdentity(identity);
    const auth = await loadAuthorization(ctx.session, input.bandPublicId);
    const result = await queryView({
        view: bandUserProfileView, ...input,
        filter: { tableParams: { personPublicId: personId } }, take: 1, cmdbQueryContext: "member profile page",
    }, auth);
    if (result.items.length === 0) {
        return { notFound: true };
    }
    return { props: { personId } };
});

const UserDetailPage: BlitzPage<PageProps> = ({ personId }) => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.profile.title")} navRealm={NavRealm.users}>
        <Suspense><BandMemberProfile personId={personId} /></Suspense>
    </DashboardLayout>;
};
export default UserDetailPage;
