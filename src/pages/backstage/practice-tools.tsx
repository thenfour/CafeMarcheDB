import { defineCmdbPage } from "src/route/cmdbPage";
// even though there is nothing band-specific about practice tools, we keep it  under the band scope,
// to allow bands to brand the page, or in the future there may be customization.
// or adding features based on subscription, which is band-specific etc...

import { useCmdbRouter } from "src/route/useCmdbRouter";
import { AppContextMarker } from "@/src/core/components/AppContext";
import { CMSinglePageSurfaceCard } from "@/src/core/components/CMCoreComponents";
import { CMLink } from "@/src/route/CMLink";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { MetronomePanel } from "@/src/core/components/Metronome";
//import { TunerCard } from "@/src/core/components/tuner/TunerCard";
import { BlitzPage } from "@blitzjs/next";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs } from "@mui/material";


////////////////////////////////////////////////////////////////
export const PracticeToolsBreadcrumbs = () => {
    const cmdbRouter = useCmdbRouter();

    return <Breadcrumbs aria-label="breadcrumb">
        <CMLink
            href={cmdbRouter.homeHref()}
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            href={cmdbRouter.href("/backstage/practice-tools")}
        >
            Practice Tools
        </CMLink>

    </Breadcrumbs>
        ;
};


const PracticeToolsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Practice tools">
            <AppContextMarker name="practice tools page">
                <PracticeToolsBreadcrumbs />
                <CMSinglePageSurfaceCard style={{ display: "flex", flexDirection: "column", alignItems: "center" }} >
                    {/* <TunerCard /> */}
                    <MetronomePanel />
                </CMSinglePageSurfaceCard>
            </AppContextMarker>
        </DashboardLayout>
    );
};

defineCmdbPage("practiceTools", PracticeToolsPage);
export default PracticeToolsPage;
