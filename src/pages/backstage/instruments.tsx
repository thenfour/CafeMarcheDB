import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import PageviewIcon from '@mui/icons-material/Pageview';
import { GridActionsCellItem } from "@mui/x-data-grid";
import { useRouter } from "next/router";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

const InstrumentListContent = () => {
    const router = useRouter();

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.instrumentEditorView,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
            autoAssignFileLeafRegex: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200, fieldCaption: "Regex" }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
            functionalGroup: columnName => new DB3Client.ForeignSingleFieldClient<db3.InstrumentFunctionalGroupClientPayload>({
                columnName,
                cellWidth: 200,
                selectionView: db3.instrumentFunctionalGroupEditorView,
            }),
            instrumentTags: columnName => new DB3Client.TagsFieldClient<db3.InstrumentTagAssociationPayload>({ columnName, cellWidth: 220, allowDeleteFromCell: false, selectionView: db3.instrumentTagEditorView }),
        },
    });


    return <>
        <SettingMarkdown setting="instrumentList_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            view={db3.instrumentEditorView}
            renderExtraActions={(args) => (
                <GridActionsCellItem
                    icon={<PageviewIcon />}
                    key="view"
                    label="View"
                    color="inherit"
                    onClick={() => {
                        void router.push(`/backstage/instrument/${args.row["id"]}`);
                    }}
                />
            )}
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
