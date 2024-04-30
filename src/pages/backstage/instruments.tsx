import { BlitzPage } from "@blitzjs/next";
import { Chip } from "@mui/material";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import PageviewIcon from '@mui/icons-material/Pageview';
import { GridActionsCellItem } from "@mui/x-data-grid";
import { useRouter } from "next/router";

const InstrumentListContent = () => {
    if (!useAuthorization("admin instruments page", Permission.admin_instruments)) {
        throw new Error(`unauthorized`);
    }
    const router = useRouter();

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xInstrument,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
            new DB3Client.SlugColumnClient({
                columnName: "slug", cellWidth: 120, previewSlug: (obj) => {
                    return null;
                }
            }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericStringColumnClient({ columnName: "autoAssignFileLeafRegex", cellWidth: 200, fieldCaption: "Regex" }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.ForeignSingleFieldClient<db3.InstrumentFunctionalGroupPayload>({ columnName: "functionalGroup", cellWidth: 200, }),
            new DB3Client.TagsFieldClient<db3.InstrumentTagAssociationPayload>({ columnName: "instrumentTags", cellWidth: 220, allowDeleteFromCell: false }),
        ],
    });


    return <>
        <SettingMarkdown setting="instrumentList_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            renderExtraActions={(args) => <GridActionsCellItem
                icon={<PageviewIcon />}
                key="view"
                label="View"
                color="inherit"
                onClick={() => {
                    void router.push(`/backstage/instrument/${args.row["slug"]}`);
                }}
            />}
        />
    </>;
};

const InstrumentListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument admin">
            <InstrumentListContent />
        </DashboardLayout>
    );
};

export default InstrumentListPage;
