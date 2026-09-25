import { loadAuthorizedPageEntity } from "@/src/auth/server/serverPageAuthorization";
import { gSSP } from "@/src/blitz-server";
import { CMLink } from "@/src/core/components/CMLink";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";
import { BlitzPage } from "@blitzjs/next";
import HomeIcon from "@mui/icons-material/Home";
import { Breadcrumbs, Typography } from "@mui/material";
import db from "db";
import { Permission } from "shared/permissions";
import { InstrumentPublicId } from "shared/publicId";
import * as db3 from "src/core/db3/db3";

interface PageProps {
    instrument: {
        publicId: InstrumentPublicId;
        name: string;
        description: string;
    };
}

export const getServerSideProps = gSSP<PageProps>(async ({ params, ctx }) => {
    let publicId: InstrumentPublicId;
    try {
        publicId = db3.xInstrument.parseIdentity(params?.slug);
    } catch {
        return { notFound: true };
    }

    const instrument = await loadAuthorizedPageEntity({
        ctx,
        permission: Permission.login,
        table: db3.xInstrument,
        identity: publicId,
        load: where => db.instrument.findFirst({
            select: { publicId: true, name: true, description: true },
            where,
        }),
    });
    if (!instrument) return { notFound: true };

    return {
        props: {
            instrument: {
                ...instrument,
                publicId: db3.xInstrument.parseIdentity(instrument.publicId),
            },
        },
    };
});

const InstrumentPage: BlitzPage<PageProps> = ({ instrument }) => (
    <DashboardLayout title={instrument.name} navRealm={NavRealm.instruments}>
        <Breadcrumbs aria-label="breadcrumb">
            <CMLink href="/backstage">
                <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                Backstage
            </CMLink>
            <CMLink href="/backstage/instruments">Instruments</CMLink>
            <Typography color="text.primary">{instrument.name}</Typography>
        </Breadcrumbs>
        {instrument.description && <Typography component="p">{instrument.description}</Typography>}
    </DashboardLayout>
);

export default InstrumentPage;
