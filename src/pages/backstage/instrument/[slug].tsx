import { BlitzPage, useParams } from "@blitzjs/next";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Link, Typography } from "@mui/material";
import { Permission } from "shared/permissions";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MyComponent = () => {
    const params = useParams();
    //return <div>{params.slug} - todo: show breadcrumbs of some sort</div>;
    return <Breadcrumbs aria-label="breadcrumb">
        <Link
            underline="hover"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center' }}
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </Link>
        <Link
            underline="hover"
            color="inherit"
            href="/backstage/instruments"
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            Instruments
        </Link>
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
