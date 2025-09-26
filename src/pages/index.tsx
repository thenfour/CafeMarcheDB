import { BlitzPage } from "@blitzjs/next";
import db from "db";
import { GetServerSideProps } from "next";
import * as db3 from "src/core/db3/db3";
import { CMPublicIndex } from "../core/components/frontpage/CMFrontpage";
import { GenericPublicIndex } from "../core/components/frontpage/GenericFrontpage";

type PublicIndexProps = {
    hostingMode: db3.HostingMode;
};

const PublicIndex: BlitzPage<PublicIndexProps> = (props) => {
    // hostingMode is available for future conditional rendering if desired
    // const mode = props.hostingMode as db3.HostingMode | null;
    switch (props.hostingMode) {
        case db3.HostingMode.CafeMarche:
            return <CMPublicIndex />;
        default:
        case db3.HostingMode.GenericSingleTenant:
            return <GenericPublicIndex />;
    };
}

export const getServerSideProps: GetServerSideProps<PublicIndexProps> = async (ctx) => {
    // Fetch the HostingMode setting server-side
    // Setting key is Dashboard_HostingMode and value is a string like "CafeMarche" | "GenericSingleTenant"
    try {
        const item = await db.setting.findFirst({ where: { name: "Dashboard_HostingMode" } });
        return {
            props: {
                hostingMode: (item?.value ?? db3.HostingMode.GenericSingleTenant) as db3.HostingMode,
            },
        };
    } catch (e) {
        console.error("Error fetching Dashboard_HostingMode setting", e);
        return {
            props: {
                hostingMode: db3.HostingMode.GenericSingleTenant,
            },
        };
    }
};

export default PublicIndex;

