import { Permission } from "@/shared/permissions";
import { AppContextMarker } from "@/src/core/components/AppContext";
import { CMSinglePageSurfaceCard } from "@/src/core/components/CMCoreComponents";
import { CMLink } from "@/src/core/components/CMLink";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { MetronomePanel } from "@/src/core/components/Metronome";
import { TunerCard } from "@/src/core/components/tuner/TunerCard";
import { BlitzPage } from "@blitzjs/next";
import { Breadcrumbs, Stack } from "@mui/material";
import HomeIcon from '@mui/icons-material/Home';


////////////////////////////////////////////////////////////////
export const PracticeToolsBreadcrumbs = () => {
    const dashboardContext = useDashboardContext();
    return <Breadcrumbs aria-label="breadcrumb">
        <CMLink
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            href="/backstage/practice-tools"
        >
            Practice Tools
        </CMLink>

    </Breadcrumbs>
        ;
};


const PracticeToolsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Practice tools" basePermission={Permission.practice_tools_use}>
            <AppContextMarker name="practice tools page">
                <PracticeToolsBreadcrumbs />
                <Stack spacing={2}>
                    <CMSinglePageSurfaceCard>
                        <MetronomePanel />
                    </CMSinglePageSurfaceCard>
                    <TunerCard />
                </Stack>
            </AppContextMarker>
        </DashboardLayout>
    );
};

export default PracticeToolsPage;
