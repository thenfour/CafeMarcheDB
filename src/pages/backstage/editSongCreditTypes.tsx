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
        view: db3.songCreditTypeEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            name: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.name", columnName }),
            description: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.description", columnName }),
            color: columnName => new DB3Client.ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.color", columnName, }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, }),
        },
    });

    return <>
        <Localized id="editSongCreditTypes_markdown" />
        <GlobalCatalogContext><DB3EditGrid tableSpec={tableSpec} view={db3.songCreditTypeEditorView} /></GlobalCatalogContext>
    </>;
};


const EditSongCreditTypesPage: BlitzPage = () => {
    const locale = useLocale();
    return (
        <DashboardLayout title={locale.getPlainString("catalog.songCreditTypes")}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongCreditTypesPage;
