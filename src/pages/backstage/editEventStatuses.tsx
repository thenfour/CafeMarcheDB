import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BandLocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { BlitzPage } from "@blitzjs/next";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { GlobalCatalogContext } from "src/core/db3/components/GlobalCatalogContext";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { useLocale } from "src/locale/components/useLocale";


const tableSpec = DB3Client.defineTableClientSpec({
    view: db3.eventStatusEditorView,
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


const MainContent = () => {
    return <>
        <BandLocalizedMarkdown id="EditEventStatusesPage_markdown" />
        <GlobalCatalogContext><DB3EditGrid tableSpec={tableSpec} view={db3.eventStatusEditorView} /></GlobalCatalogContext>
    </>;
};


const EditEventStatusesPage: BlitzPage = () => {
    const locale = useLocale();
    return (
        <DashboardLayout title={locale.getPlainString("eventCatalog.statuses.title")}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventStatusesPage;
