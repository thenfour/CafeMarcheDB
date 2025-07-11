import { BlitzPage } from "@blitzjs/next";
import db from "db";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { SettingKey } from "shared/settings";
import { gSSP } from "src/blitz-server";
import { AppContextMarker } from "src/core/components/AppContext";
import { useRecordFeatureUse } from "src/core/components/DashboardContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { WikiPageControl } from "src/core/components/wiki/WikiComponents";
import { getAuthenticatedCtx } from "src/core/db3/server/db3mutationCore";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { GetWikiPageCore } from "src/core/wiki/server/getWikiPageCore";
import { wikiParsePathComponents, WikiPath } from "src/core/wiki/shared/wikiUtils";


const WikiPageComponent = ({ wikiPath, wikiPageId }: { wikiPath: WikiPath, wikiPageId: number | undefined }) => {
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
    wikiPageId: number | null;
};

// type Props = {
//     publicData: SessionContext["$publicData"],
// }

export const getServerSideProps = gSSP<PageProps>(async (args) => {
    const wikiPath = wikiParsePathComponents((args.params?.slug || []) as string[]);
    const actx = getAuthenticatedCtx(args.ctx, Permission.view_wiki_pages);
    if (!actx) {
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
        ctx: actx,
        clientBaseRevisionId: null,
        clientLockId: null,
        currentUserId: null,
    });

    const retProps: PageProps = {
        title: ret.wikiPage?.currentRevision?.name ?? wikiPath.slugWithoutNamespace,
        wikiPath,
        wikiPageId: ret.wikiPage?.id ?? null,
    };

    return {
        props: retProps,
    };

    // return {
    //     props: {
    //         title: ret.wikiPage?.currentRevision?.name ?? wikiPath.slugWithoutNamespace,
    //         wikiPath,
    //         //slug: args.params?.slug as string[],
    //         //publicData: args.ctx.session.$publicData,
    //     },
    // };
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
