import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import type { BlitzPage } from "@blitzjs/next";
import { Alert } from "@mui/material";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { bandWikiPageTagView } from "src/core/db3/shared/entities/wikiPageTag/wikiPageTagViews";
import { defineTableClientSpec } from "src/core/db3/components/DB3ClientCore";
import { GenericIntegerColumnClient, ColorColumnClient, BoolColumnClient } from "src/core/db3/components/DB3ClientBasicFields";
import { LocalizedStringColumnClient, InheritedColumnClient } from "src/core/db3/components/DB3CatalogFields";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

export const bandWikiPageTagTableSpec = defineTableClientSpec({
    view: bandWikiPageTagView,
    columns: {
        name: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        color: columnName => new InheritedColumnClient(
            new ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "catalog.color", columnName }),
            { fieldCaptionKey: "catalog.color" }),
        sortOrder: columnName => new InheritedColumnClient(
            new GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "catalog.sortOrder", columnName }),
            { fieldCaptionKey: "catalog.sortOrder" }),
        isHidden: columnName => new BoolColumnClient({ columnName, fieldCaptionKey: "catalog.hidden", fieldDescriptionKey: null }),
    },
});
const MainContent = () => {
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const locale = useLocale();
    return <>
        <LocalizedMarkdown setting="editWikiPageTags_markdown" />
        {presentation.bandPublicId ? <DB3EditGrid
            tableSpec={bandWikiPageTagTableSpec}
            view={bandWikiPageTagView}
            referenceProvider={dashboard.referenceStore}
        />
            : <Alert severity="info">{locale.getPlainString("catalog.selectBand")}</Alert>}
    </>;
};
const EditWikiPageTagsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("catalog.wikiPageTags")}><MainContent /></DashboardLayout>;
};
export default EditWikiPageTagsPage;
