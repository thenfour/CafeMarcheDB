import { BlitzPage, useParams } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Suspense } from "react";
import { slugify } from "shared/rootroot";
import { IsNullOrWhitespace } from "shared/utils";
import { NavRealm } from "src/core/components/Dashboard2";
import { WikiPageControl } from "src/core/components/WikiComponents";
import getWikiPage from "src/core/db3/queries/getWikiPage";
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

    return <WikiPageControl value={(item?.revisions[0]) || null} slug={slug} onUpdated={itemsExtra.refetch} />
};

interface PageProps {
    title: string,
};

export const getServerSideProps = async ({ params }) => {
    const [slug] = params.slug as string[];
    if (IsNullOrWhitespace(slug)) throw new Error(`no page specified`);
    return {
        props: { title: "a wiki page" }
    };
}

const WikiPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title} navRealm={NavRealm.songs}>
            <Suspense>
                <WikiPageComponent></WikiPageComponent>
            </Suspense>
        </DashboardLayout>
    )
}

export default WikiPage;
