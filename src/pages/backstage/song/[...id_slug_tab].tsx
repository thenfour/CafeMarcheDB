import { BlitzPage, useParams } from "@blitzjs/next";
import db from "db";
import React, { Suspense } from 'react';
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, StringToEnumValue } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { AppContextMarker } from "src/core/components/AppContext";
import { NavRealm } from "src/core/components/Dashboard2";
import { DashboardContext, useRecordFeatureUse } from "src/core/components/DashboardContext";
import { NewSongButton } from "src/core/components/NewSongComponents";
import { SongBreadcrumbs, SongClientColumns, SongDetail, SongDetailTabSlug } from "src/core/components/SongComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { ActivityFeature } from "src/core/db3/shared/activityTracking";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const MyComponent = ({ songId }: { songId: number | null }) => {
    const params = useParams();
    const [id__, slug, tab] = params.id_slug_tab as string[];

    const dashboardContext = React.useContext(DashboardContext);

    if (!songId) throw new Error(`song not found`);

    useRecordFeatureUse({ feature: ActivityFeature.song_view, songId });

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
                //SongClientColumns.slug,
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

    let initialTab: SongDetailTabSlug = SongDetailTabSlug.info;
    if (!!tab) {
        initialTab = StringToEnumValue(SongDetailTabSlug, tab) || SongDetailTabSlug.info;
    }

    const tableClient = DB3Client.useTableRenderContext(queryArgs);
    if (tableClient.items.length > 1) throw new Error(`db returned too many songs; issues with filtering? exploited slug/id? count=${tableClient.items.length}`);
    if (tableClient.items.length < 1) throw new Error(`Song not found`);
    const songRaw = tableClient.items[0]! as db3.SongPayload_Verbose;
    const song = db3.enrichSong(songRaw, dashboardContext);

    return <div className="songsDetailComponent">
        <NewSongButton />
        {song ? <>
            <SongBreadcrumbs song={song} />
            <SongDetail readonly={false} song={song} tableClient={tableClient} initialTab={initialTab} />
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
            title: "Song",
            songId: null,
        }
    };
    const song = await db.song.findFirst({
        select: {
            id: true,
            name: true,
        },
        where: {
            id,
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
        <DashboardLayout title={x.title} navRealm={NavRealm.songs} basePermission={Permission.view_songs}>
            <AppContextMarker name="song page" songId={x.songId || undefined}>
                <Suspense>
                    <MyComponent songId={x.songId}></MyComponent>
                </Suspense>
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default SongDetailPage;
