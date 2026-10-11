import { BlitzPage } from "@blitzjs/next";
import db from "db";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import type { WikiPagePublicId } from "shared/publicId";
import { gSSP } from "src/blitz-server";
import { AppContextMarker } from "src/core/components/AppContext";
import { BandLocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { WikiPageControl } from "src/core/components/wiki/WikiComponents";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { GetWikiPageCore } from "src/core/wiki/server/getWikiPageCore";
import { wikiParsePathComponents, WikiPath, ZWikiBand } from "src/core/wiki/shared/wikiUtils";
import { useRecordFeatureUse } from "@/src/core/components/dashboardContext/DashboardContext";


const WikiPageComponent = ({ wikiPath, wikiPageId }: { wikiPath: WikiPath, wikiPageId: WikiPagePublicId | undefined }) => {
    useRecordFeatureUse({
        feature: ActivityFeature.wiki_page_view,
        wikiPageId,
    });

    return <>
        <BandLocalizedMarkdown id="GlobalWikiPage_Markdown" />

        <WikiPageControl wikiPath={wikiPath} />
    </>;
};

type PageProps = {
    title: string;
    wikiPath: WikiPath;
    wikiPageId: WikiPagePublicId | null;
};

export const getServerSideProps = gSSP<PageProps>(async (args) => {
    const components = args.params?.slug;
    if (!Array.isArray(components) || !components.every(value => typeof value === "string")) {
        return { notFound: true };
    }
    const wikiPath = wikiParsePathComponents(components); // lsmb TODO: centralize route parsing
    const selectedBand = args.query.bandPublicId;
    const band = selectedBand === undefined ? null : ZWikiBand.safeParse(selectedBand);
    if (band && !band.success) {
        return { notFound: true };
    }
    const auth = await loadAuthorization(args.ctx.session, band?.success ? band.data : undefined);
    if (!band && auth.user && auth.hasPermission(Permission.login)) {
        return { props: { title: wikiPath.slugWithoutNamespace, wikiPath, wikiPageId: null } };
    }
    if (!auth.user || !auth.hasPermission(Permission.view_wiki_pages)) {
        return {
            redirect: {
                destination: "/",
                permanent: false,
            },
        };
    }

    const ret = await GetWikiPageCore({
        canonicalWikiSlug: wikiPath.canonicalWikiPath || "<never>",
        database: db,
        authorization: auth,
        clientBaseContentVersion: 0,
        clientBaseRevisionId: null,
        clientLockId: null,
    });

    const retProps: PageProps = {
        title: ret.wikiPage?.currentRevision?.name ?? wikiPath.slugWithoutNamespace,
        wikiPath,
        wikiPageId: ret.wikiPage?.publicId ?? null,
    };

    return {
        props: retProps,
    };

});

const WikiPage: BlitzPage = (x: PageProps) => {
    // if (x.wikiPageId == null) {
    //     return <div>Wiki page not found</div>;
    // }
    return (
        <DashboardLayout title={x.title}>
            <AppContextMarker name="wiki page" wikiPageId={x.wikiPageId || undefined}>
                <Suspense>
                    <WikiPageComponent wikiPath={x.wikiPath} wikiPageId={x.wikiPageId || undefined}></WikiPageComponent>
                </Suspense>
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default WikiPage;
