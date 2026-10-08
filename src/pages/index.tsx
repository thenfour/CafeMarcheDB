import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useLocale } from "src/locale/components/useLocale";

export default function PublicIndex() {
    const locale = useLocale();
    return <main style={{ padding: 24 }}>
        <Head><title>{locale.getPlainString("recovery.publicPublication.title")}</title></Head>
        <h1>{locale.getPlainString("recovery.publicPublication.title")}</h1>
        <p role="status">{locale.getPlainString("recovery.publicPublication.description")}</p>
        <Link href="/backstage">{locale.getPlainString("recovery.backstage")}</Link>
    </main>;
}

// MIGRATION_RESTORE: public-publication
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/index.tsx:1-36
// Reason: Public homepage/feed and gallery editors still use unscoped content queries.
// Restore: Restore band-specific public homepage, agenda, galleries and feed delivery, including hosting modes, language selection, CORS, image editing and visibility with explicit public band routing and authorized reads/writes.
// Verification: Verify anonymous and member publication in two bands/locales, privacy, CORS/feed consumers, gallery ordering/images and built-browser homepage/editor workflows.
// SHA256: fc60646b33fbede7210bad29381e6f5f41147c4863d73eea5445854389addf32
// MIGRATION_REFERENCE_BEGIN
// import { useBrand } from "@/shared/brandConfig";
// import { HostingMode } from "@/shared/brandConfigBase";
// import { BlitzPage } from "@blitzjs/next";
// import { GetServerSideProps } from "next";
// import { CMPublicIndex } from "../core/components/frontpage/CMFrontpage";
// import { GenericPublicIndex } from "../core/components/frontpage/GenericFrontpage";
// import { PublicFeedResponseSpec } from "../core/db3/shared/publicTypes";
// import { ServerApi } from "../server/serverApi";
//
// const PublicIndex: BlitzPage<{ publicFeed: PublicFeedResponseSpec }> = (props) => {
//     const brand = useBrand();
//     switch (brand.hostingMode) {
//         case HostingMode.CafeMarche:
//             return <CMPublicIndex publicFeed={props.publicFeed} />;
//         default:
//         case HostingMode.GenericSingleTenant:
//             return <GenericPublicIndex />;
//     };
// }
//
// export const getServerSideProps: GetServerSideProps<{ publicFeed: PublicFeedResponseSpec }> = async (ctx) => {
//     const uri = ServerApi.getAbsoluteUri(`/api/public?lang=${ctx.locale || "en"}`);
//     const res = await fetch(uri);
//     if (!res.ok) {
//         const responseBody = (await res.text()).slice(0, 1000);
//         throw new Error(`Public feed request failed (${res.status} ${res.statusText}): ${responseBody}`);
//     }
//     const publicFeed: PublicFeedResponseSpec = await res.json();
//     return {
//         props: {
//             publicFeed,
//         },
//     };
// };
//
// export default PublicIndex;
// MIGRATION_REFERENCE_END
