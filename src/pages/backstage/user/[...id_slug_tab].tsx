import { loadAuthorizedPageEntity } from "@/src/auth/server/serverPageAuthorization";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { gSSP } from "@/src/blitz-server";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { UserBreadcrumbs } from "@/src/core/components/user/UserComponents";
import { UserDetail } from "@/src/core/components/user/UserDetail";
import { enrichUser } from "@/src/core/db3/shared/schema/enrichedUserTypes";
import { BlitzPage, Routes, useParams } from "@blitzjs/next";
import db from "db";
import { useRouter } from "next/router";
import { Suspense } from 'react';
import { Permission } from "shared/permissions";
import type { UserPublicId } from "shared/publicId";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";

const MyComponent = ({ userId }: { userId: UserPublicId | null }) => {
    const params = useParams();
    const router = useRouter();
    const [id__, slug, tab] = params.id_slug_tab as string[];

    const dashboardContext = useDashboardContext();
    //const id = CoerceToNumberOrNull(id__);
    //if (!id) throw new Error(`no id`);

    //console.log(params);
    //const [_, tabIdOrSlug] = params.idOrSlug_tab as string[];

    if (!userId) throw new Error(`user not found`);

    const queryArgs = {
        includeDeleted: dashboardContext.isAuthorized(Permission.recover_users),
        view: db3.userEditorView,
        tableSpec: DB3Client.defineTableClientSpec({
            view: db3.userEditorView,
            columns: {
                publicId: DB3Client.publicIdFieldGen(),
                name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 160 }),
                email: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
                phone: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 120 }),
                cssClass: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
                createdAt: columnName => new DB3Client.CreatedAtColumn({ columnName, cellWidth: 200 }),
                instruments: columnName => new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
                tags: DB3Client.tagsFieldClientGen<db3.UserTagPayload>({ allowDeleteFromCell: false, selectionView: db3.userTagEditorView }),

                // required to be able to edit.
                role: DB3Client.foreignRefFieldGen<db3.RoleDisplay>({ selectionView: db3.roleEditorView }),
            },
        }),
        filterModel: {
            publicIds: [userId]
        }
    };

    const tableClient = DB3Client.useCrudTableRenderContext(queryArgs);
    if (tableClient.items.length > 1) throw new Error(`db returned too many items; issues with filtering? exploited slug/id? count=${tableClient.items.length}`);
    if (tableClient.items.length < 1) {
        console.warn(`no user found with id ${userId}`);
        void router.push(Routes.UserSearchPage());
        return null;
    }
    // The editor view supplies the scalar user fields while enrichUser replaces
    // its partial role, tag, and instrument relations from dashboard references.
    const userRaw = tableClient.items[0]! as unknown as db3.UserClientPayload;
    const user = enrichUser(userRaw, dashboardContext.role, dashboardContext.userTag, dashboardContext.instrument);

    return <div className="songsDetailComponent">
        {user ? <>
            <UserBreadcrumbs user={user} />
            <UserDetail readonly={false} user={user} tableClient={tableClient} />
        </> : <>no user was found (??)</>}
    </div>;
};

interface PageProps {
    title: string,
    userId: UserPublicId | null,
};

export const getServerSideProps = gSSP<PageProps>(async ({ params, ctx }) => {
    const [id__] = params!.id_slug_tab as string[];
    if (!db3.xUser.isIdentity(id__)) return { notFound: true };
    const publicId = db3.xUser.parseIdentity(id__);

    // id: required always. even though we have "slugs", we require the ID to avoid conflicts.
    // slug: ignored.
    // tab: optional string

    // formats supported:
    // /backstage/song/2             => ["2"]
    // /backstage/song/2/slug/info   => ["2", "slug", "info"]
    // /backstage/song/2/whateveridontcare/info

    const { effectivePermissions } = await getRequestAuthorization(ctx.session);
    const user = await loadAuthorizedPageEntity({
        ctx,
        permission: Permission.view_users_basic_info,
        table: db3.xUser,
        identity: publicId,
        includeDeleted: effectivePermissions.includesName(Permission.recover_users),
        load: where => db.user.findFirst({
            select: {
                publicId: true,
                name: true,
            },
            where,
        }),
    });
    if (!user) return { notFound: true };

    return { props: { title: user.name, userId: publicId } };
});

const UserDetailPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title} navRealm={NavRealm.users}>
            <Suspense>
                <MyComponent userId={x.userId}></MyComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default UserDetailPage;
