import { BlitzPage } from "@blitzjs/next";
import db from "db";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import type { WikiPagePublicId } from "shared/publicId";
import { SettingKey } from "shared/settingKeys";
import { gSSP } from "src/blitz-server";
import { AppContextMarker } from "src/core/components/AppContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { WikiPageControl } from "src/core/components/wiki/WikiComponents";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { GetWikiPageCore } from "src/core/wiki/server/getWikiPageCore";
import { wikiParsePathComponents, WikiPath } from "src/core/wiki/shared/wikiUtils";
import { useRecordFeatureUse } from "@/src/core/components/dashboardContext/DashboardContext";


const WikiPageComponent = ({ wikiPath, wikiPageId }: { wikiPath: WikiPath, wikiPageId: WikiPagePublicId | undefined }) => {
    useRecordFeatureUse({
        feature: ActivityFeature.wiki_page_view,
        wikiPageId,
    });

    return <>
        <SettingMarkdown setting="GlobalWikiPage_Markdown"></SettingMarkdown>
        <SettingMarkdown setting={`WikiPage_${wikiPath.canonicalWikiPath}_Markdown` as SettingKey}></SettingMarkdown>
        <WikiPageControl wikiPath={wikiPath} />
    </>;
};

type PageProps = {
    title: string;
    wikiPath: WikiPath;
    wikiPageId: WikiPagePublicId | null;
};

export const getServerSideProps = gSSP<PageProps>(async (args) => {
    const wikiPath = wikiParsePathComponents((args.params?.slug || []) as string[]);
    const auth = await loadAuthorization(args.ctx.session);
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
        dbt: db as any,
        ctx: args.ctx,
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
