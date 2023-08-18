import { BlitzPage, useParams } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Breadcrumbs, Link, Typography } from "@mui/material";
import HomeIcon from '@mui/icons-material/Home';


const MyComponent = () => {
    const params = useParams();
    if (!useAuthorization(`instrument page: ${params.slug}`, Permission.view_instruments)) {
        throw new Error(`unauthorized`);
    }
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
        <DashboardLayout title="Instrument">
            <MyComponent></MyComponent>
        </DashboardLayout>
    )
}

export default InstrumentPage;
