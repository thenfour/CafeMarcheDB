import { BlitzPage } from "@blitzjs/next";
import { GetServerSideProps } from "next";
import { HostingMode, getHostingMode } from "shared/brandConfig";
import { CMPublicIndex } from "../core/components/frontpage/CMFrontpage";
import { GenericPublicIndex } from "../core/components/frontpage/GenericFrontpage";

const PublicIndex: BlitzPage<{}> = (props) => {
    switch (getHostingMode()) {
        case HostingMode.CafeMarche:
            return <CMPublicIndex />;
        default:
        case HostingMode.GenericSingleTenant:
            return <GenericPublicIndex />;
    };
}

export const getServerSideProps: GetServerSideProps<{}> = async (ctx) => {
    return {
        props: {
        },
    };
};

export default PublicIndex;

