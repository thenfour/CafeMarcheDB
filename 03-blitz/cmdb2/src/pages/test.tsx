import { BlitzPage, Routes } from "@blitzjs/next";
import { NoSsr } from "@mui/material";
import { useRouter } from "next/router";
import React, { FC, Suspense } from "react"
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { InspectObject } from "src/core/components/CMCoreComponents";
import { HomepageMain } from "src/core/components/homepageComponents";
import { API, HomepageAgendaItemSpec, HomepageContentSpec } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import Head from "next/head"

const MainContent = () => {
    const eventsTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
        ],
    });

    const clientIntention: db3.xTableClientUsageContext = { intention: "public", mode: "primary" };

    const eventsFilterModel: db3.CMDBTableFilterModel = {
        items: [
            {
                field: "frontpageVisible",
                operator: "equals",
                value: true
            }
        ],
    };

    const eventsClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec: eventsTableSpec,
        filterModel: eventsFilterModel,
    });

    const galleryTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFrontpageGalleryItem,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
        ],
    });

    const galleryClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec: galleryTableSpec,
        //filterModel: ,
    });

    const content: HomepageContentSpec = {
        gallery: (galleryClient.items as db3.FrontpageGalleryItemPayload[]),
        agenda: (eventsClient.items as db3.EventPayload[]).map((x): HomepageAgendaItemSpec => API.events.getAgendaItem(x)),
    };

    return <NoSsr>
        <HomepageMain content={content} className="realFrontpage" fullPage={true} />
    </NoSsr>;
};


const TestPage2: BlitzPage = () => {
    return <>
        <link href="/homepage/public.css" rel="stylesheet" type="text/css" />
        <Suspense>
            <MainContent />
        </Suspense>
        hi.
    </>;
}

export default TestPage2;

