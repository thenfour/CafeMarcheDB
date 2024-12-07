import { BlitzPage, useParams } from "@blitzjs/next";
import db from "db";
import React, { Suspense } from 'react';
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { NavRealm } from "src/core/components/Dashboard2";
import { DashboardContext } from "src/core/components/DashboardContext";
import { UserBreadcrumbs, UserDetail } from "src/core/components/UserComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const MyComponent = ({ userId }: { userId: number | null }) => {
    const params = useParams();
    const [id__, slug, tab] = params.id_slug_tab as string[];

    const dashboardContext = React.useContext(DashboardContext);
    //const id = CoerceToNumberOrNull(id__);
    //if (!id) throw new Error(`no id`);

    //console.log(params);
    //const [_, tabIdOrSlug] = params.idOrSlug_tab as string[];

    if (!userId) throw new Error(`user not found`);

    const currentUser = useCurrentUser()[0]!;
    //const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: currentUser, };

    const queryArgs: DB3Client.xTableClientArgs = {
        requestedCaps: DB3Client.xTableClientCaps.Mutation | DB3Client.xTableClientCaps.Query,
        clientIntention: dashboardContext.userClientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xUser,
            columns: [
            ],
        }),
        filterModel: {
            items: [],
            tableParams: {},
            pks: [userId]
        }
    };

    const tableClient = DB3Client.useTableRenderContext(queryArgs);
    if (tableClient.items.length > 1) throw new Error(`db returned too many items; issues with filtering? exploited slug/id? count=${tableClient.items.length}`);
    if (tableClient.items.length < 1) throw new Error(`item not found`);
    const userRaw = tableClient.items[0]! as db3.UserPayload;
    const user = db3.enrichUser(userRaw, dashboardContext.role, dashboardContext.userTag, dashboardContext.instrument);

    return <div className="songsDetailComponent">
        {user ? <>
            <UserBreadcrumbs user={user} />
            <UserDetail readonly={false} user={user} tableClient={tableClient} />
        </> : <>no user was found (??)</>}
    </div>;
};

interface PageProps {
    title: string,
    userId: number | null,
};

export const getServerSideProps = async ({ params }) => {
    const [id__, slug, tab] = params.id_slug_tab as string[];
    const id = CoerceToNumberOrNull(id__);
    if (!id) throw new Error(`no id`);

    // id: required always. even though we have "slugs", we require the ID to avoid conflicts.
    // slug: ignored.
    // tab: optional string

    // formats supported:
    // /backstage/song/2             => ["2"]
    // /backstage/song/2/slug/info   => ["2", "slug", "info"]
    // /backstage/song/2/whateveridontcare/info

    const ret: { props: PageProps } = {
        props: {
            title: "User",
            userId: null,
        }
    };
    const user = await db.user.findFirst({
        select: {
            id: true,
            name: true,
        },
        where: {
            id,
        }
    });
    if (user) {
        ret.props.title = `${user.name}`;
        ret.props.userId = user.id;
    }

    return ret;
}

const UserDetailPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title} navRealm={NavRealm.users} basePermission={Permission.view_songs}>
            <Suspense>
                <MyComponent userId={x.userId}></MyComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default UserDetailPage;
