import React, { Suspense } from "react";
import type { BlitzPage } from "@blitzjs/next";
import { useRouter } from "next/router";
import db from "db";
import type { SongPublicId } from "shared/publicId";
import { StringToEnumValue } from "shared/utils";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { gSSP } from "src/blitz-server";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "src/core/components/dashboard/StaticMenuItems";
import { useDashboardContext, useRecordFeatureUse } from "src/core/components/dashboardContext/DashboardContext";
import { AppContextMarker } from "src/core/components/AppContext";
import { NewSongButton } from "src/core/components/song/NewSongComponents";
import { SongBreadcrumbs, SongClientColumns, SongDetail, SongDetailTabSlug } from "src/core/components/song/SongComponents";
import { ActivityFeature } from "src/core/components/featureReports/activityTracking";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { readSongDetailPage } from "src/core/db3/server/songDetailPage";
import { resolvePagePresentationInput } from "src/route/server/portalRequest";
import { useLocale } from "src/locale/components/useLocale";

interface PageProps { readonly title: string; readonly songId: SongPublicId }

export const getServerSideProps = gSSP<PageProps>(async ({ params, query, req, ctx }) => {
    const path = params?.id_slug_tab;
    const identity = Array.isArray(path) ? path[0] : undefined;
    const input = await resolvePagePresentationInput(req, query);
    if (!db3.xSong.isIdentity(identity) || !input.bandPublicId) {
        return { notFound: true };
    }
    const auth = await loadAuthorization(ctx.session, input.bandPublicId);
    const result = await readSongDetailPage(db, auth, input, db3.xSong.parseIdentity(identity));
    return result ? { props: result } : { notFound: true };
});

const SongDetailContent = ({ songId }: Pick<PageProps, "songId">) => {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const router = useRouter();
    const path = router.query.id_slug_tab;
    const tab = Array.isArray(path) ? path[2] : undefined;
    useRecordFeatureUse({ feature: ActivityFeature.song_view, songId });
    const tableClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec: DB3Client.defineTableClientSpec({
            view: db3.songDetailView,
            columns: DB3Client.makeClientColumnSelection(
                SongClientColumns.publicId,
                SongClientColumns.name,
                SongClientColumns.aliases,
                SongClientColumns.startBPM,
                SongClientColumns.endBPM,
                SongClientColumns.introducedYear,
                SongClientColumns.lengthSeconds,
                SongClientColumns.tags,
                SongClientColumns.visiblePermission,
            ),
        }),
        filterModel: { tableParams: { songId } },
        referenceProvider: dashboard.referenceStore,
        queryOptions: { staleTime: 0, cacheTime: 0, keepPreviousData: false },
    });
    const song = tableClient.items[0];
    const initialTab = tab ? StringToEnumValue(SongDetailTabSlug, tab) ?? SongDetailTabSlug.info : SongDetailTabSlug.info;
    return <div className="songsDetailComponent">
        <NewSongButton />
        {song ? <>
            <SongBreadcrumbs song={song} />
            <SongDetail readonly={false} song={song} tableClient={tableClient} initialTab={initialTab} />
        </> : <p>{locale.getPlainString("songs.detailUnavailable")}</p>}
    </div>;
};

const SongDetailScope = ({ songId }: Pick<PageProps, "songId">) => {
    const dashboard = useDashboardContext();
    return <SongDetailContent key={`${dashboard.authorizationContext?.bandPublicId}:${songId}`} songId={songId} />;
};

const SongDetailPage: BlitzPage<PageProps> = ({ title, songId }) => {
    return <DashboardLayout title={title} navRealm={NavRealm.songs}>
        <AppContextMarker name="song page" songId={songId}>
            <Suspense>
                <SongDetailScope songId={songId} />
            </Suspense>
        </AppContextMarker>
    </DashboardLayout>;
};
export default SongDetailPage;
