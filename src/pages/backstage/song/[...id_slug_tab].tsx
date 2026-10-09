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
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { useLocale } from "src/locale/components/useLocale";

interface PageProps { readonly title: string; readonly songId: SongPublicId }

export const getServerSideProps = gSSP<PageProps>(async ({ params, query, req, ctx }) => {
    const path = params?.id_slug_tab;
    const identity = Array.isArray(path) ? path[0] : undefined;
    const input = pagePresentationInput(query, req.headers["accept-language"]);
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

// MIGRATION_RESTORE: song-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/backstage/song/[...id_slug_tab].tsx:1-123
// Reason: Song and credit screens still depend on undeclared ownership and obsolete dedicated endpoints.
// Restore: Restore song search/detail/editing, credits and pinned recording with fresh selected-band authorization, visible files and public localized references; retain the recovered narrow song lookup and setlist persistence.
// Verification: Verify two bands, visibility, deleted records, revoked grants, credits, pinned recording and complete built-browser song workflows.
// SHA256: 6df33f4a9b5a9195bcce5ae50e19b0adf5b266f8c443e9ac8421b3e08f0c4458
// MIGRATION_REFERENCE_BEGIN
// import { loadAuthorizedPageEntity } from "@/src/auth/server/serverPageAuthorization";
// import { gSSP } from "@/src/blitz-server";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";
// import { useRecordFeatureUse } from "@/src/core/components/dashboardContext/DashboardContext";
// import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
// import { BlitzPage, useParams } from "@blitzjs/next";
// import db from "db";
// import { Suspense } from 'react';
// import { Permission } from "shared/permissions";
// import { StringToEnumValue } from "shared/utils";
// import type { SongPublicId } from "shared/publicId";
// import { AppContextMarker } from "src/core/components/AppContext";
// import { NewSongButton } from "src/core/components/song/NewSongComponents";
// import { SongBreadcrumbs, SongClientColumns, SongDetail, SongDetailTabSlug } from "src/core/components/song/SongComponents";
// import * as DB3Client from "src/core/db3/DB3Client";
// import * as db3 from "src/core/db3/db3";
//
// const MyComponent = ({ songId }: { songId: SongPublicId | null }) => {
//     const params = useParams();
//     const [id__, slug, tab] = params.id_slug_tab as string[];
//
//     if (!songId) throw new Error(`song not found`);
//
//     useRecordFeatureUse({ feature: ActivityFeature.song_view, songId });
//
//
//
//     const tableSpec = DB3Client.defineTableClientSpec({
//         view: db3.songDetailView,
//         columns: DB3Client.makeClientColumnSelection(
//             SongClientColumns.publicId,
//             SongClientColumns.name,
//             SongClientColumns.aliases,
//             SongClientColumns.startBPM,
//             SongClientColumns.endBPM,
//             SongClientColumns.introducedYear,
//             SongClientColumns.lengthSeconds,
//             SongClientColumns.tags,
//             SongClientColumns.visiblePermission,
//         ),
//     });
//
//     const tableClient = DB3Client.useDb3Query({
//         view: db3.songDetailView,
//         requestedCaps: DB3Client.xTableClientCaps.Query,
//         tableSpec,
//         filterSpec: {
//             tableParams: { songId },
//         },
//     });
//
//     let initialTab: SongDetailTabSlug = SongDetailTabSlug.info;
//     if (!!tab) {
//         initialTab = StringToEnumValue(SongDetailTabSlug, tab) || SongDetailTabSlug.info;
//     }
//
//     if (tableClient.items.length !== 1) throw new Error(`Unexpected number of songs returned: ${tableClient.items.length}`);
//     const song = tableClient.items[0]!;
//
//     return <div className="songsDetailComponent">
//         <NewSongButton />
//         {song ? <>
//             <SongBreadcrumbs song={song} />
//             <SongDetail readonly={false} song={song} tableClient={tableClient} initialTab={initialTab} />
//         </> : <>
//             no song was found. some possibilities:
//             <ul>
//                 <li>the song was deleted or you don't have permission to view it</li>
//                 <li>the song's slug (title) or ID changed.</li>
//             </ul>
//         </>}
//     </div>;
// };
//
// interface PageProps {
//     title: string,
//     songId: SongPublicId | null,
// };
//
// export const getServerSideProps = gSSP<PageProps>(async ({ params, ctx }) => {
//     const [id__] = params!.id_slug_tab as string[];
//     if (!db3.xSong.isIdentity(id__)) return { notFound: true };
//     const publicId = db3.xSong.parseIdentity(id__);
//
//     // id: required always. even though we have "slugs", we require the ID to avoid conflicts.
//     // slug: ignored.
//     // tab: optional string
//
//     // formats supported:
//     // /backstage/song/<publicId>/slug/info
//
//     const song = await loadAuthorizedPageEntity({
//         ctx,
//         permission: Permission.view_songs,
//         table: db3.xSong,
//         identity: publicId,
//         load: where => db.song.findFirst({
//             select: {
//                 publicId: true,
//                 name: true,
//             },
//             where,
//         }),
//     });
//     if (!song) return { notFound: true };
//
//     return { props: { title: song.name, songId: db3.xSong.parseIdentity(song.publicId) } };
// });
//
// const SongDetailPage: BlitzPage = (x: PageProps) => {
//     return (
//         <DashboardLayout title={x.title} navRealm={NavRealm.songs}>
//             <AppContextMarker name="song page" songId={x.songId || undefined}>
//                 <Suspense>
//                     <MyComponent songId={x.songId}></MyComponent>
//                 </Suspense>
//             </AppContextMarker>
//         </DashboardLayout>
//     )
// }
//
// export default SongDetailPage;
// MIGRATION_REFERENCE_END
