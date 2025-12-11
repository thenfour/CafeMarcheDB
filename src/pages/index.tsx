import { useBrand } from "@/shared/brandConfig";
import { HostingMode } from "@/shared/brandConfigBase";
import { BlitzPage } from "@blitzjs/next";
import { GetServerSideProps } from "next";
import { CMPublicIndex } from "../core/components/frontpage/CMFrontpage";
import { GenericPublicIndex } from "../core/components/frontpage/GenericFrontpage";
import { PublicFeedResponseSpec } from "../core/db3/shared/publicTypes";
import { ServerApi } from "../server/serverApi";

const PublicIndex: BlitzPage<{ publicFeed: PublicFeedResponseSpec }> = (props) => {
    const brand = useBrand();
    switch (brand.hostingMode) {
        case HostingMode.CafeMarche:
            return <CMPublicIndex publicFeed={props.publicFeed} />;
        default:
        case HostingMode.GenericSingleTenant:
            return <GenericPublicIndex />;
    };
}

export const getServerSideProps: GetServerSideProps<{ publicFeed: PublicFeedResponseSpec }> = async (ctx) => {
    const uri = ServerApi.getAbsoluteUri(`/api/public?lang=${ctx.locale || "en"}`);
    const res = await fetch(uri);
    const publicFeed: PublicFeedResponseSpec = await res.json();
    return {
        props: {
            publicFeed,
        },
    };
};

export default PublicIndex;

