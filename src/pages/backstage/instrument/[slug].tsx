import type { BlitzPage } from "@blitzjs/next";
import db, { Prisma } from "db";
import { gSSP } from "src/blitz-server";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "src/core/components/dashboard/StaticMenuItems";
import { BandInstrumentCatalog } from "src/core/db3/components/BandInstrumentCatalog";
import { loadBandInstrumentCatalog } from "src/core/db3/server/bandInstrumentCatalog";
import { InstrumentIdentity } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { useLocale } from "src/locale/components/useLocale";

interface PageProps {
    publicId: string
}

export const getServerSideProps = gSSP<PageProps>(async ({ params, query, req, ctx }) => {
    const identity = InstrumentIdentity.safeParse(params?.slug);
    const input = pagePresentationInput(query, req.headers["accept-language"]);
    if (!identity.success || !input.bandPublicId) {
        return { notFound: true };
    }
    const auth = await loadAuthorization(ctx.session, input.bandPublicId);
    const catalog = await db.$transaction(async tx => {
        return loadBandInstrumentCatalog(tx, await auth.refresh(tx), input);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    if (!catalog.instruments.some(row => row.publicId === identity.data)) {
        return { notFound: true };
    }
    return { props: { publicId: identity.data } };
});

const InstrumentPage: BlitzPage<PageProps> = ({ publicId }) => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("instrument.title")} navRealm={NavRealm.instruments}>
        <BandInstrumentCatalog detailPublicId={publicId} />
    </DashboardLayout>;
};

export default InstrumentPage;
