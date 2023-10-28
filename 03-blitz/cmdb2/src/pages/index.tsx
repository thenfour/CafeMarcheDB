import { BlitzPage, Routes } from "@blitzjs/next";
import { NoSsr } from "@mui/material";
import { useRouter } from "next/router";
import React, { FC, Suspense } from "react"
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { InspectObject } from "src/core/components/CMCoreComponents";
import { HomepageMain } from "src/core/components/homepageComponents";
import { API, useFrontpageData } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { HomepageAgendaItemSpec, HomepageContentSpec } from "src/core/db3/shared/apiTypes";

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

    const content : HomepageContentSpec = {
        gallery: [],
        agenda: (eventsClient.items as db3.EventPayload[]).map((x) : HomepageAgendaItemSpec => API.events.getAgendaItem(x)),
    };

    return <NoSsr>
    <div className="flexShrink"></div>
    <HomepageMain content={content}/>
    <div className="flexShrink"></div>
    </NoSsr>;
};

const PublicIndex: BlitzPage = () => {
    return <>
        <link href="/homepage/public.css" rel="stylesheet" type="text/css" />
        <Suspense>
            <MainContent />
        </Suspense>    
        </>;
}

export default PublicIndex;



// <!doctype html>
// <html>

// <head>
//     <meta charset="utf-8">
//     <title>Café Marché | Brussels fanfare-orkest</title>
//     <meta name="siteid" content="be">
//     <meta name="countryid" content="BE">
//     <meta name="country" content="Belgium">
//     <meta name="Language" content="en">
//     <meta name="robots" content="index, follow">
//     <meta name="description" content="Café Marché is a Brussels-based band / fanfare / orchestra, for live shows, street performance, parades.">
//     <meta name="keywords" content="brussels, concert, music, fanfare, brass band, orchestra, live music, street music, majorettes, parade, trumpet, trombone, violin, viola, cello, flute, clarinet, guitar, drums, bass, piano, accordion, percussion, zang, singing, vocals">
//     <script>

// window.addEventListener("error", (e) => {
//   let logel = document.getElementById("errorlog");
//   if (!logel) {
//     logel = document.createElement("div");
//     logel.id = "errorlog";
//     document.body.appendChild(logel);
//   }
//   const entry = document.createElement("pre");
//   entry.innerText = `x @ ${e.filename}:${e.lineno}
// message: ${e.message}
// type: ${e.type}
// error.message: ${e.error.message}
// error.stack: ${e.error.stack.toString()}
// `;
//   logel.appendChild(entry);
// });

//     </script>
    
//     <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
//     <script src="https://unpkg.com/react@17/umd/react.development.js" crossorigin></script>
//     <script src="https://unpkg.com/react-dom@17/umd/react-dom.development.js" crossorigin></script>
//     <script src="https://unpkg.com/babel-standalone@6/babel.min.js" crossorigin></script>

//     <script src="/CM.js?v=<?=date("H:i:s")?>" type="text/babel"></script>

//     <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
//     <link rel="stylesheet" href="/CM.css?v=<?=date("H:i:s")?>" />
//     <link rel="icon" type="image/png" href="favicon.png" />
// </head>

// <body id="body">
//     <div id="root"></div>
// </body>

// </html>




