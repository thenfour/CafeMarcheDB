import { useBrand } from "@/shared/brandConfig";
import { HostingMode } from "@/shared/brandConfigBase";
import { BlitzPage } from "@blitzjs/next";
import { GetServerSideProps } from "next";
import { CMPublicIndex } from "../core/components/frontpage/CMFrontpage";
import { GenericPublicIndex } from "../core/components/frontpage/GenericFrontpage";

const PublicIndex: BlitzPage<{}> = (props) => {
    const brand = useBrand();
    switch (brand.hostingMode) {
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

