import { HomepageMain } from "@/src/core/components/frontpage/homepageComponents";
import { useSession } from "@blitzjs/auth";
import { NoSsr } from "@mui/material";
import Head from "next/head";
import React, { Suspense } from "react";
import { EnNlFr, LangSelectString } from "shared/lang";
import GoogleAnalytics from "src/core/components/GoogleAnalytics";
import type { PublicFeedInput } from "src/core/db3/shared/publicFeedInput";
import { PublicFeedResponseSpec } from "../../db3/shared/publicTypes";
import { useCmdbRouter } from "@/src/route/useCmdbRouter";

interface CMPublicIndexProps {
    publicFeed: PublicFeedResponseSpec;
    selection: PublicFeedInput;
    lang: EnNlFr;
}

const MainContent = ({ lang, onLangChange, publicFeed, selection }: CMPublicIndexProps & { onLangChange: (newLang: EnNlFr) => void }) => {
    const sess = useSession();
    return <NoSsr>
        <GoogleAnalytics trackingId={sess.GOOGLE_ANALYTICS_ID_PUBLIC} />
        <HomepageMain key={JSON.stringify(selection)} content={publicFeed} presentation={selection}
            className="realFrontpage" fullPage={true} lang={lang} onLangChange={onLangChange} />
    </NoSsr>;
};

export const CMPublicIndex = (props: CMPublicIndexProps) => {
    const router = useCmdbRouter();
    const handleManualLangChange = async (newLang: EnNlFr) => {
        await router.switchLanguage(newLang);
    };
    const lang = props.lang;
    const titleText = `Café Marché | Brussels fanfare-orkest`;

    return <>
        <Head>
            <title>{titleText}</title>
            <meta charSet="utf-8" />

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
            <MainContent {...props} onLangChange={handleManualLangChange} />
            <div></div>
        </Suspense>

    </>;
}
