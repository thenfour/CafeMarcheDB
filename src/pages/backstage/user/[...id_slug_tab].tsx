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


// MIGRATION_RESTORE: member-profile
// Source: 1768352278c2ac37768c8bd2c2cc0ad5ffd4324a:src/pages/backstage/user/[...id_slug_tab].tsx:1-126
// Reason: The basic membership profile no longer routes through the complete user-detail workflow.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 016b360f041c7d82ba2b0014f01973deb323e196e361d337e29ec006d88fcdf5
// MIGRATION_REFERENCE_BEGIN
// import { loadAuthorizedPageEntity } from "@/src/auth/server/serverPageAuthorization";
// import { loadAuthorization } from "@/src/auth/server/serverAuthorization";
// import { gSSP } from "@/src/blitz-server";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";
// import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
// import { UserBreadcrumbs } from "@/src/core/components/user/UserComponents";
// import { UserDetail } from "@/src/core/components/user/UserDetail";
// import { enrichUser } from "@/src/core/db3/shared/schema/enrichedUserTypes";
// import { BlitzPage, Routes, useParams } from "@blitzjs/next";
// import db from "db";
// import { useRouter } from "next/router";
// import { Suspense } from 'react';
// import { Permission } from "shared/permissions";
// import type { UserPublicId } from "shared/publicId";
// import * as DB3Client from "src/core/db3/DB3Client";
// import * as db3 from "src/core/db3/db3";
//
// const MyComponent = ({ userId }: { userId: UserPublicId | null }) => {
//     const params = useParams();
//     const router = useRouter();
//     const [id__, slug, tab] = params.id_slug_tab as string[];
//
//     const dashboardContext = useDashboardContext();
//     //const id = CoerceToNumberOrNull(id__);
//     //if (!id) throw new Error(`no id`);
//
//     //console.log(params);
//     //const [_, tabIdOrSlug] = params.idOrSlug_tab as string[];
//
//     if (!userId) throw new Error(`user not found`);
//
//     const queryArgs = {
//         includeDeleted: dashboardContext.isAuthorized(Permission.recover_users),
//         view: db3.userEditorView,
//         tableSpec: DB3Client.defineTableClientSpec({
//             view: db3.userEditorView,
//             columns: {
//                 publicId: DB3Client.publicIdFieldGen(),
//                 name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 160 }),
//                 email: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
//                 phone: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 120 }),
//                 cssClass: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
//                 createdAt: columnName => new DB3Client.CreatedAtColumn({ columnName, cellWidth: 200 }),
//                 instruments: columnName => new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
//                 tags: DB3Client.tagsFieldClientGen<db3.UserTagPayload>({ allowDeleteFromCell: false, selectionView: db3.userTagEditorView }),
//
//                 // required to be able to edit.
//                 role: DB3Client.foreignRefFieldGen<db3.RoleDisplay>({ selectionView: db3.roleEditorView }),
//             },
//         }),
//         filterModel: {
//             publicIds: [userId]
//         }
//     };
//
//     const tableClient = DB3Client.useCrudTableRenderContext(queryArgs);
//     if (tableClient.items.length > 1) throw new Error(`db returned too many items; issues with filtering? exploited slug/id? count=${tableClient.items.length}`);
//     if (tableClient.items.length < 1) {
//         console.warn(`no user found with id ${userId}`);
//         void router.push(Routes.UserSearchPage());
//         return null;
//     }
//     // The editor view supplies the scalar user fields while enrichUser replaces
//     // its partial role, tag, and instrument relations from dashboard references.
//     const userRaw = tableClient.items[0]! as unknown as db3.UserClientPayload;
//     const user = enrichUser(userRaw, dashboardContext.role, dashboardContext.userTag, dashboardContext.instrument);
//
//     return <div className="songsDetailComponent">
//         {user ? <>
//             <UserBreadcrumbs user={user} />
//             <UserDetail readonly={false} user={user} tableClient={tableClient} />
//         </> : <>no user was found (??)</>}
//     </div>;
// };
//
// interface PageProps {
//     title: string,
//     userId: UserPublicId | null,
// };
//
// export const getServerSideProps = gSSP<PageProps>(async ({ params, ctx }) => {
//     const [id__] = params!.id_slug_tab as string[];
//     if (!db3.xUser.isIdentity(id__)) return { notFound: true };
//     const publicId = db3.xUser.parseIdentity(id__);
//
//     // id: required always. even though we have "slugs", we require the ID to avoid conflicts.
//     // slug: ignored.
//     // tab: optional string
//
//     // formats supported:
//     // /backstage/song/2             => ["2"]
//     // /backstage/song/2/slug/info   => ["2", "slug", "info"]
//     // /backstage/song/2/whateveridontcare/info
//
//     const { effectivePermissions } = await loadAuthorization(ctx.session);
//     const user = await loadAuthorizedPageEntity({
//         ctx,
//         permission: Permission.view_users_basic_info,
//         table: db3.xUser,
//         identity: publicId,
//         includeDeleted: effectivePermissions.includesName(Permission.recover_users),
//         load: where => db.user.findFirst({
//             select: {
//                 publicId: true,
//                 name: true,
//             },
//             where,
//         }),
//     });
//     if (!user) return { notFound: true };
//
//     return { props: { title: user.name, userId: publicId } };
// });
//
// const UserDetailPage: BlitzPage = (x: PageProps) => {
//     return (
//         <DashboardLayout title={x.title} navRealm={NavRealm.users}>
//             <Suspense>
//                 <MyComponent userId={x.userId}></MyComponent>
//             </Suspense>
//         </DashboardLayout>
//     )
// }
//
// export default UserDetailPage;
// MIGRATION_REFERENCE_END
