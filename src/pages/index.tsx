import { BlitzPage } from "@blitzjs/next";
import { GetServerSideProps } from "next";
import * as db3 from "src/core/db3/db3";
import { CMPublicIndex } from "../core/components/frontpage/CMFrontpage";
import { GenericPublicIndex } from "../core/components/frontpage/GenericFrontpage";
import { BrandConfig, HostingMode } from "shared/brandConfig";

// type PublicIndexProps = {
//     hostingMode: db3.HostingMode;
// };

const PublicIndex: BlitzPage<{}> = (props) => {
    // hostingMode is available for future conditional rendering if desired
    // const mode = props.hostingMode as db3.HostingMode | null;
    switch (BrandConfig.hostingMode) {
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

