import { BlitzPage } from "@blitzjs/next";
import db from "db";
import { Suspense } from "react";
import { SettingKey } from "shared/utils";
import { useWikiPageApi } from "src/core/components/markdown/useWikiPageApi";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { WikiPageControl } from "src/core/components/WikiComponents";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { GetWikiPageCore } from "src/core/wiki/server/getWikiPageCore";
import { wikiParsePathComponents, WikiPath } from "src/core/wiki/shared/wikiUtils";


const WikiPageComponent = ({ wikiPath }: { wikiPath: WikiPath }) => {

    const wikiPageApi = useWikiPageApi({ canonicalWikiPath: wikiPath.canonicalWikiPath });

    return <>
        <SettingMarkdown setting="GlobalWikiPage_Markdown"></SettingMarkdown>
        <SettingMarkdown setting={`WikiPage_${wikiPath.canonicalWikiPath}_Markdown` as SettingKey}></SettingMarkdown>
        <WikiPageControl wikiPageApi={wikiPageApi} />
    </>;
};

interface PageProps {
    title: string;
    wikiPath: WikiPath;
};

export const getServerSideProps = async ({ params }) => {
    const wikiPath = wikiParsePathComponents(params.slug as string[]);
    const ret = await GetWikiPageCore({
        canonicalWikiSlug: wikiPath.canonicalWikiPath || "<never>",
        dbt: db,
    });

    return {
        props: {
            title: ret.wikiPage?.currentRevision?.name ?? wikiPath.slugWithoutNamespace,
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
