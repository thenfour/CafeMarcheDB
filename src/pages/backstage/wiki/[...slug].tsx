import { BlitzPage, useParams } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Button } from "@mui/material";
import db from "db";
import { Suspense } from "react";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, IsEntirelyIntegral, IsNullOrWhitespace, slugify } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { NavRealm } from "src/core/components/Dashboard2";
import { NewSongButton } from "src/core/components/NewSongComponents";
import { SongBreadcrumbs, SongClientColumns, SongDetail, gSongDetailTabSlugIndices } from "src/core/components/SongComponents";
import { WikiPageControl } from "src/core/components/WikiComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
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
