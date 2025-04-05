import { SessionContext } from "@blitzjs/auth";
import { BlitzPage } from "@blitzjs/next";
import db from "db";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { SettingKey } from "shared/settings";
import { gSSP } from "src/blitz-server";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { WikiPageControl } from "src/core/components/WikiComponents";
import { getAuthenticatedCtx } from "src/core/db3/server/db3mutationCore";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { GetWikiPageCore } from "src/core/wiki/server/getWikiPageCore";
import { wikiParsePathComponents, WikiPath } from "src/core/wiki/shared/wikiUtils";


const WikiPageComponent = ({ wikiPath }: { wikiPath: WikiPath }) => {

    return <>
        <SettingMarkdown setting="GlobalWikiPage_Markdown"></SettingMarkdown>
        <SettingMarkdown setting={`WikiPage_${wikiPath.canonicalWikiPath}_Markdown` as SettingKey}></SettingMarkdown>
        <WikiPageControl wikiPath={wikiPath} />
    </>;
};

interface PageProps {
    title: string;
    wikiPath: WikiPath;
};

type Props = {
    publicData: SessionContext["$publicData"],
}

export const getServerSideProps = gSSP<Props>(async (args) => {
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
        dbt: db,
        ctx: actx,
        clientBaseRevisionId: null,
        clientLockId: null,
        currentUserId: null,
    });

    return {
        props: {
            title: ret.wikiPage?.currentRevision?.name ?? wikiPath.slugWithoutNamespace,
            wikiPath,
            slug: args.params?.slug as string[],
            publicData: args.ctx.session.$publicData,
        },
    };
});

// export const getServerSideProps = async (args) => {
//     const wikiPath = wikiParsePathComponents(params.slug as string[]);
//     const ret = await GetWikiPageCore({
//         canonicalWikiSlug: wikiPath.canonicalWikiPath || "<never>",
//         dbt: db,
//         clientBaseRevisionId: null,
//         clientLockId: null,
//         currentUserId: null,
//     });

//     return {
//         props: {
//             title: ret.wikiPage?.currentRevision?.name ?? wikiPath.slugWithoutNamespace,
//             wikiPath,
//         }
//     };
// }

const WikiPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title}>
            <Suspense>
                <WikiPageComponent wikiPath={x.wikiPath}></WikiPageComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default WikiPage;
