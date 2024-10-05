import { BlitzPage } from "@blitzjs/next";
import { NoSsr } from "@mui/material";
import Head from "next/head";
import { Suspense } from "react";
import { HomepageMain } from "src/core/components/homepageComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { API, HomepageContentSpec } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import { CMDBTableFilterModel } from "src/core/db3/shared/apiTypes";
import React from "react";
import { EnNlFr, LangSelectString } from "shared/utils";
import { GetServerSideProps } from "next";
import { cookies } from "next/headers";

const MainContent = ({ lang, onLangChange }: { lang: EnNlFr, onLangChange: (newLang: EnNlFr) => void }) => {
    const eventsTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
        ],
    });

    const clientIntention: db3.xTableClientUsageContext = { intention: "public", mode: "primary" };

    const eventsFilterModel: CMDBTableFilterModel = {
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

    const events = API.events.sortEvents(eventsClient.items as db3.EventPayload[]);
    const agenda = events.map(x => API.events.getAgendaItem(x, lang));

    const content: HomepageContentSpec = {
        gallery: (galleryClient.items as db3.FrontpageGalleryItemPayload[]),
        agenda,
    };

    return <NoSsr>
        <HomepageMain content={content} className="realFrontpage" fullPage={true} lang={lang} onLangChange={onLangChange} />
    </NoSsr>;
};



type PublicIndexProps = {
    browserLang: EnNlFr;
};


export const getServerSideProps: GetServerSideProps = async ({ req, ...ctx }) => {
    const acceptLanguage = req.headers['accept-language'];
    const cookieLang = req.cookies.lang; //cookie.parse(req.headers.cookie || '');

    const toEnNlFr = (s): EnNlFr | undefined => {
        if (!s) return undefined;
        if (s.startsWith("nl")) {
            return "nl";
        } else if (s.startsWith("fr")) {
            return "fr";
        }
        return "en";
    };

    const acceptLangAsEnNlFr = toEnNlFr(acceptLanguage);
    const cookieLangAsEnNlFr = toEnNlFr(cookieLang);

    const browserLang: EnNlFr = cookieLangAsEnNlFr || acceptLangAsEnNlFr || "en";

    const props: PublicIndexProps = {
        browserLang,
    };

    // Pass the detected language as a prop
    return {
        props,
    };
};


const PageRoot = ({ browserLang }: PublicIndexProps) => {
};


const PublicIndex: BlitzPage = (props: PublicIndexProps) => {
    const [userSelectedLang, setUserSelectedLang] = React.useState<EnNlFr | null>(null);

    const handleManualLangChange = (newLang: EnNlFr) => {
        setUserSelectedLang(newLang);
    };

    // you can't use window.* because this is run on the server.
    //const storedLang = window.localStorage.getItem("lang") as EnNlFr | null;

    const lang = userSelectedLang || props.browserLang;

    // React.useEffect(() => {
    //     window.localStorage.setItem("lang", lang);
    // }, [lang]);

    return <>
        <Head>
            <title>Café Marché | Brussels fanfare-orkest</title>
            <meta charSet="utf-8" />
            <link rel="icon" type="image/png" href="/favicon.png" />

            <meta name="siteid" content="be" />
            <meta name="countryid" content="BE" />
            <meta name="country" content="Belgium" />
            <meta name="Language" content={lang} />
            <meta name="robots" content="index, follow" />
            <meta name="description" content={LangSelectString(lang,
                "Café Marché is a Brussels-based band / fanfare / orchestra, for live shows, street performance, parades.",
                "Café Marché is een fanfare-orkest uit Brussel voor live shows, straatoptredens en parades.",
                "Café Marché est une fanfare basée à Bruxelles pour des spectacles en direct, des performances de rue et des parades."
            )} />
            <meta
                name="keywords"
                content={LangSelectString(lang,
                    "brussels, concert, music, fanfare, brass band, orchestra, live music, street music, majorettes, parade, trumpet, trombone, violin, viola, cello, flute, clarinet, guitar, drums, bass, piano, accordion, percussion, zang, singing, vocals",
                    "brussel, concert, muziek, fanfare, brass band, orkest, live muziek, straatmuziek, majorettes, parade, trompet, trombone, viool, altviool, cello, dwarsfluit, klarinet, gitaar, drums, bas, piano, accordeon, percussie, zang, vocals",
                    "bruxelles, concert, musique, fanfare, brass band, orchestre, musique live, musique de rue, majorettes, parade, trompette, trombone, violon, alto, violoncelle, flûte, clarinette, guitare, batterie, basse, piano, accordéon, percussions, chant, chant"
                )
                }
            />
        </Head>
        <link href="/homepage/public.css" rel="stylesheet" type="text/css" />
        <Suspense>
            <MainContent lang={lang} onLangChange={handleManualLangChange} />
        </Suspense>

    </>;
}

export default PublicIndex;

