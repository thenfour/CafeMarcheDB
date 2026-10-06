import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import type { BlitzPage } from "@blitzjs/next";
import { Alert } from "@mui/material";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { bandUserTagView } from "src/core/db3/shared/entities/user/bandUserTagViews";
import { defineTableClientSpec } from "src/core/db3/components/DB3ClientCore";
import { GenericStringColumnClient, GenericIntegerColumnClient, ColorColumnClient, BoolColumnClient } from "src/core/db3/components/DB3ClientBasicFields";
import { LocalizedStringColumnClient, InheritedColumnClient, catalogColumn } from "src/core/db3/components/DB3CatalogFields";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

export const bandUserTagTableSpec = defineTableClientSpec({
    view: bandUserTagView,
    columns: {
        name: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        color: columnName => new InheritedColumnClient(new ColorColumnClient({ columnName, cellWidth: 250 }), { fieldCaptionKey: "catalog.color" }),
        sortOrder: columnName => new InheritedColumnClient(new GenericIntegerColumnClient({ columnName, cellWidth: 80 }), { fieldCaptionKey: "catalog.sortOrder" }),
        isHidden: columnName => catalogColumn(new BoolColumnClient({ columnName }), "catalog.hidden"),
        cssClass: columnName => new InheritedColumnClient(new GenericStringColumnClient({ columnName, fieldCaptionKey: "catalog.cssClass", fieldDescriptionKey: null }), { fieldCaptionKey: "catalog.cssClass" }),
    },
});

const MainContent = () => {
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const locale = useLocale();
    return <>
        <LocalizedMarkdown setting="EditUserTagsPage_markdown" />
        {presentation.bandPublicId ? <DB3EditGrid tableSpec={bandUserTagTableSpec} view={bandUserTagView} referenceProvider={dashboard.referenceStore} />
            : <Alert severity="info">{locale.getPlainString("catalog.selectBand")}</Alert>}
    </>;
};

const EditUserTagsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("catalog.userTags")}><MainContent /></DashboardLayout>;
};
export default EditUserTagsPage;
