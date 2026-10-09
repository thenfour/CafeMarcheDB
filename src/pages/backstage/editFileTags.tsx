import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import type { BlitzPage } from "@blitzjs/next";
import { Alert } from "@mui/material";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { bandFileTagView, globalFileTagView } from "src/core/db3/shared/entities/file/fileTagCatalogs";
import { defineTableClientSpec } from "src/core/db3/components/DB3ClientCore";
import { GenericIntegerColumnClient, ColorColumnClient, BoolColumnClient, ConstEnumStringFieldClient } from "src/core/db3/components/DB3ClientBasicFields";
import { LocalizedStringColumnClient, InheritedColumnClient } from "src/core/db3/components/DB3CatalogFields";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { Localized } from "src/setting/client/components/SettingMarkdown";

export const bandFileTagTableSpec = defineTableClientSpec({
    view: bandFileTagView,
    columns: {
        name: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        color: columnName => new InheritedColumnClient(
            new ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "catalog.color", columnName }),
            { fieldCaptionKey: "catalog.color" }
        ),
        sortOrder: columnName => new InheritedColumnClient(
            new GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "catalog.sortOrder", columnName }),
            { fieldCaptionKey: "catalog.sortOrder" }
        ),
        isHidden: columnName => new BoolColumnClient({ columnName, fieldCaptionKey: "catalog.hidden", fieldDescriptionKey: null }),
    },
});
export const globalFileTagTableSpec = defineTableClientSpec({
    view: globalFileTagView,
    columns: {
        name: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        color: columnName => new ColorColumnClient({ columnName, fieldCaptionKey: "catalog.color", fieldDescriptionKey: null }),
        sortOrder: columnName => new GenericIntegerColumnClient({ columnName, fieldCaptionKey: "catalog.sortOrder", fieldDescriptionKey: null }),
        significance: columnName => new ConstEnumStringFieldClient({ columnName, fieldCaptionKey: "db3.fields.significance", fieldDescriptionKey: null }),
    },
});
export const FileTagCatalogContent = () => {
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const locale = useLocale();
    return <>
        <Localized id="EditFileTagsPage_markdown" />
        {presentation.bandPublicId && <Alert severity="info">{locale.getPlainString("catalog.fileTagsSharedDefaults")}</Alert>}
        {presentation.bandPublicId ? <DB3EditGrid
            tableSpec={bandFileTagTableSpec} view={bandFileTagView}
            referenceProvider={dashboard.referenceStore}
        /> : <DB3EditGrid
            tableSpec={globalFileTagTableSpec} view={globalFileTagView}
            referenceProvider={dashboard.referenceStore}
        />}
    </>;
};
const EditFileTagsPage: BlitzPage = () => {
    const locale = useLocale();
    const presentation = usePresentation();
    return <DashboardLayout title={locale.getPlainString(presentation.bandPublicId ? "catalog.fileTags" : "catalog.globalFileTags")}><FileTagCatalogContent /></DashboardLayout>;
};
export default EditFileTagsPage;
