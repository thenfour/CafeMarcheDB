import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Suspense } from "react";
import { SettingKey } from "shared/utils";
import { wikiParsePathComponents, WikiPath } from "src/core/db3/shared/wikiUtils";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { WikiPageControl } from "src/core/components/WikiComponents";
import getWikiPage from "src/core/db3/queries/getWikiPage";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { GetWikiPageCore } from "src/core/db3/server/getWikiPageCore";


const WikiPageComponent = ({ wikiPath }: { wikiPath: WikiPath }) => {
    const [item, itemsExtra] = useQuery(getWikiPage, {
        slug: wikiPath.canonicalWikiPath,
    });

    return <>
        <SettingMarkdown setting="GlobalWikiPage_Markdown"></SettingMarkdown>
        <SettingMarkdown setting={`WikiPage_${wikiPath.canonicalWikiPath}_Markdown` as SettingKey}></SettingMarkdown>
        <WikiPageControl wikiPageData={item} wikiPath={wikiPath} onUpdated={itemsExtra.refetch} />
    </>;
};

interface PageProps {
    title: string;
    wikiPath: WikiPath;
};

export const getServerSideProps = async ({ params }) => {
    const wikiPath = wikiParsePathComponents(params.slug as string[]);
    const ret = await GetWikiPageCore({
        slug: wikiPath.canonicalWikiPath || "<never>",
    });

    return {
        props: {
            title: ret.latestRevision.name,
            wikiPath,
        }
    };
}

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
