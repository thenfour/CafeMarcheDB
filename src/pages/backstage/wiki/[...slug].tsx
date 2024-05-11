import { BlitzPage, useParams } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Suspense } from "react";
import { slugify } from "shared/rootroot";
import { IsNullOrWhitespace, SettingKey } from "shared/utils";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { WikiPageControl } from "src/core/components/WikiComponents";
import getWikiPage from "src/core/db3/queries/getWikiPage";
import { GetWikiPageCore } from "src/core/db3/server/wikiPage";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const WikiPageComponent = () => {
    const params = useParams();
    if (!params.slug) throw new Error(`no page specified`);
    let [slug, ...extra] = params.slug as string[];
    if (!slug) throw new Error(`no page specified`);
    slug = slugify(slug);

    const [item, itemsExtra] = useQuery(getWikiPage, {
        slug,
    });

    return <>
        <SettingMarkdown setting="GlobalWikiPage_Markdown"></SettingMarkdown>
        <SettingMarkdown setting={`WikiPage_${slug}_Markdown` as SettingKey}></SettingMarkdown>
        <WikiPageControl value={(item?.revisions[0]) || null} slug={slug} onUpdated={itemsExtra.refetch} />
    </>;
};

interface PageProps {
    title: string,
};

export const getServerSideProps = async ({ params }) => {
    const [slug] = params.slug as string[];
    if (IsNullOrWhitespace(slug)) throw new Error(`no page specified`);

    const ret = await GetWikiPageCore({
        slug: slug || "<never>",
    });

    return {
        props: { title: `${ret?.revisions[0]?.name || "<unknown>"} (wiki)` }
    };
}

const WikiPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title}>
            <Suspense>
                <WikiPageComponent></WikiPageComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default WikiPage;
