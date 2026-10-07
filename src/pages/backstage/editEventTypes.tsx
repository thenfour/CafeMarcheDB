import { GlobalEventCatalogContext } from "src/core/db3/components/GlobalEventCatalogContext";
import { useLocale } from "src/locale/components/useLocale";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

const MainContent = () => {

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.eventTypeEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
            name: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.name", columnName }),
            description: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.description", columnName }),
            color: columnName => new DB3Client.ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.color", columnName, cellWidth: 300 }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, cellWidth: 80 }),
            significance: columnName => new DB3Client.ConstEnumStringFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.significance", columnName, cellWidth: 120 }),
            iconName: columnName => new DB3Client.IconFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.icon", columnName, cellWidth: 120 }),
        },
    });

    return <>
        <LocalizedMarkdown setting="EditEventTypesPage_markdown"></LocalizedMarkdown>
        <GlobalEventCatalogContext><DB3EditGrid tableSpec={tableSpec} view={db3.eventTypeEditorView} /></GlobalEventCatalogContext>
    </>;
};


const EditEventTypesPage: BlitzPage = () => {
    const locale = useLocale();
    return (
        <DashboardLayout title={locale.getPlainString("eventCatalog.types.title")}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventTypesPage;
