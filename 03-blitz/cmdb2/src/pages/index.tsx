import { BlitzPage, Routes } from "@blitzjs/next";
import { NoSsr } from "@mui/material";
import { useRouter } from "next/router";
import React, { FC, Suspense } from "react"
import { HomepageMain } from "src/core/components/homepageComponents";
import { useFrontpageData } from "src/core/db3/clientAPI";

const MainContent = () => {
    const router = useRouter();
    const content = useFrontpageData();
    //<a href="/backstage">go backstage...</a>

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




