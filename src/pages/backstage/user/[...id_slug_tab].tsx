import { defineCmdbPage } from "src/route/cmdbPage";
import React, { Suspense } from "react";
import type { BlitzPage } from "@blitzjs/next";
import type { UserPublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { gSSP } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "src/core/components/dashboard/StaticMenuItems";
import { BandMemberProfile } from "src/core/components/user/BandMemberProfile";
import { AccountProfilePageContent } from "src/core/components/user/AccountProfile";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { bandUserProfileView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { platformUserEditorView } from "src/core/db3/shared/entities/user/platformUser";
import { xUserMinimum } from "src/core/db3/shared/schema/user";
import { resolvePagePresentationInput } from "src/route/server/portalRequest";

interface PageProps { readonly personId: UserPublicId; readonly profileScope: "band" | "account"; readonly title: string }

export const getServerSideProps = gSSP<PageProps>(async ({ params, query, req, ctx }) => {
    const path = params?.id_slug_tab;
    const identity = Array.isArray(path) ? path[0] : undefined;
    const input = await resolvePagePresentationInput(req, query);
    if (!xUserMinimum.isIdentity(identity)) {
        return { notFound: true };
    }
    const personId = xUserMinimum.parseIdentity(identity);
    const auth = await loadAuthorization(ctx.session, input.bandPublicId ?? null);
    if (!input.bandPublicId) {
        if (!auth.hasPermission(Permission.manage_global_users)) {
            return { notFound: true };
        }
        const account = await queryView({
            ...input, bandPublicId: null, view: platformUserEditorView, filter: { publicIds: [personId] },
            includeDeleted: true, take: 1, cmdbQueryContext: "account profile page",
        }, auth);
        const person = account.items[0];
        return person ? { props: { personId, profileScope: "account", title: person.name } } : { notFound: true };
    }
    const result = await queryView({
        view: bandUserProfileView, ...input,
        filter: { tableParams: { personPublicId: personId } }, take: 1, cmdbQueryContext: "member profile page",
    }, auth);
    const person = result.items[0]?.user;
    if (person?.name === undefined) {
        return { notFound: true };
    }
    return { props: { personId, profileScope: "band", title: person.name } };
});

const UserDetailPage: BlitzPage<PageProps> = ({ personId, profileScope, title }) => {
    return <DashboardLayout title={title} navRealm={NavRealm.users}>
        <Suspense>{profileScope === "band" ? <BandMemberProfile personId={personId} /> : <AccountProfilePageContent personId={personId} />}</Suspense>
    </DashboardLayout>;
};
defineCmdbPage("bandUser", UserDetailPage);
export default UserDetailPage;
