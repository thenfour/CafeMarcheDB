import { BlitzPage, useParams } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { IsEntirelyIntegral } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { NavRealm } from "src/core/components/Dashboard2";
import { EventBreadcrumbs, EventDetail, EventTableClientColumns, gEventDetailTabSlugIndices } from "src/core/components/EventComponents";
import { SongBreadcrumbs, SongClientColumns, SongDetail, gSongDetailTabSlugIndices } from "src/core/components/SongComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import db, { Prisma } from "db";

const MyComponent = ({ songId }: { songId: number | null }) => {
    const params = useParams();
    const [_, tabIdOrSlug] = params.idOrSlug_tab as string[];

    if (!songId) throw new Error(`song not found`);

    if (!useAuthorization(`song page: ${songId}`, Permission.view_songs)) {
        throw new Error(`unauthorized`);
    }

    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: currentUser, };

    const queryArgs: DB3Client.xTableClientArgs = {
        requestedCaps: DB3Client.xTableClientCaps.Mutation | DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xSong_Verbose,
            columns: [
                SongClientColumns.id,
                SongClientColumns.name,
                SongClientColumns.aliases,
                SongClientColumns.slug,
                //SongClientColumns.description,
                SongClientColumns.startBPM,
                SongClientColumns.endBPM,
                SongClientColumns.introducedYear,
                SongClientColumns.lengthSeconds,
                SongClientColumns.tags,
                //SongClientColumns.createdByUser,
                SongClientColumns.visiblePermission,
            ],
        }),
        filterModel: {
            items: [],
            tableParams: {}
        }
    };

    queryArgs.filterModel!.tableParams!.songId = songId;

    let initialTabIndex: undefined | number = undefined;
    if (tabIdOrSlug) {
        if (IsEntirelyIntegral(tabIdOrSlug)) {
            initialTabIndex = parseInt(tabIdOrSlug);
        } else {
            initialTabIndex = gSongDetailTabSlugIndices[tabIdOrSlug];
        }
    }

    const tableClient = DB3Client.useTableRenderContext(queryArgs);
    if (tableClient.items.length > 1) throw new Error(`db returned too many songs; issues with filtering? exploited slug/id? count=${tableClient.items.length}`);
    const song = tableClient.items[0]! as db3.SongPayload_Verbose;

    return <div>
        {song ? <>
            <SongBreadcrumbs song={song} />
            <SongDetail readonly={false} song={song} tableClient={tableClient} initialTabIndex={initialTabIndex} isOnlySongVisible={true} allowRouterPush={true} />
        </> : <>
            no song was found. some possibilities:
            <ul>
                <li>the song was deleted or you don't have permission to view it</li>
                <li>the song's slug (title) or ID changed.</li>
            </ul>
        </>}
    </div>;
};

interface PageProps {
    title: string,
    songId: number | null,
};

export const getServerSideProps = async ({ params }) => {
    const [idOrSlugOptional] = params.idOrSlug_tab as string[];
    const idOrSlug = idOrSlugOptional || "";
    const ret: { props: PageProps } = {
        props: {
            title: "Song",
            songId: null,
        }
    };
    const song = await db.song.findFirst({
        select: {
            id: true,
            name: true,
        },
        where: IsEntirelyIntegral(idOrSlug) ? {
            id: parseInt(idOrSlug),
        } : {
            slug: idOrSlug,
        }
    });
    if (song) {
        ret.props.title = `${song.name}`;
        ret.props.songId = song.id;
    }

    return ret;
}

const SongDetailPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title} navRealm={NavRealm.songs}>
            <Suspense>
                <MyComponent songId={x.songId}></MyComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default SongDetailPage;