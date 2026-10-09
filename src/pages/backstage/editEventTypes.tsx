import { GlobalCatalogContext } from "src/core/db3/components/GlobalCatalogContext";
import { useLocale } from "src/locale/components/useLocale";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { Localized } from "@/src/setting/client/components/SettingMarkdown";
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
            color: columnName => new DB3Client.ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.color", columnName, }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, }),
            significance: columnName => new DB3Client.ConstEnumStringFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.significance", columnName, }),
            iconName: columnName => new DB3Client.IconFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.icon", columnName, }),
        },
    });

    return <>
        <Localized id="EditEventTypesPage_markdown" />
        <GlobalCatalogContext><DB3EditGrid tableSpec={tableSpec} view={db3.eventTypeEditorView} /></GlobalCatalogContext>
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
