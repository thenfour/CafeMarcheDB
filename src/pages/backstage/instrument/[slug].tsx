import { CMLink } from "@/src/core/components/CMLink";
import { BlitzPage, useParams } from "@blitzjs/next";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Typography } from "@mui/material";
import { Permission } from "shared/permissions";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";


const MyComponent = () => {
    const params = useParams();
    //return <div>{params.slug} - todo: show breadcrumbs of some sort</div>;
    return <Breadcrumbs aria-label="breadcrumb">
        <CMLink
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            href="/backstage/instruments"
        >
            Instruments
        </CMLink>
        <Typography color="text.primary">{params.slug}</Typography>
    </Breadcrumbs>;
};


const InstrumentPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument" basePermission={Permission.basic_trust}>
            <MyComponent></MyComponent>
        </DashboardLayout>
    )
}

export default InstrumentPage;
