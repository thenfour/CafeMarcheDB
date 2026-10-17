import { defineCmdbPage } from "src/route/cmdbPage";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import type { BlitzPage } from "@blitzjs/next";
import { Alert } from "@mui/material";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { InheritedColumnClient, LocalizedStringColumnClient } from "src/core/db3/components/DB3CatalogFields";
import { BoolColumnClient, ColorColumnClient, GenericIntegerColumnClient, GenericStringColumnClient } from "src/core/db3/components/DB3ClientBasicFields";
import { defineTableClientSpec } from "src/core/db3/components/DB3ClientCore";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { bandSongTagView } from "src/core/db3/shared/entities/song/bandSongTagViews";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

export const bandSongTagTableSpec = defineTableClientSpec({
    view: bandSongTagView,
    columns: {
        name: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        color: columnName => new InheritedColumnClient(
            new ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "catalog.color", columnName, }),
            { fieldCaptionKey: "catalog.color" }),
        sortOrder: columnName => new InheritedColumnClient(
            new GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "catalog.sortOrder", columnName, }),
            { fieldCaptionKey: "catalog.sortOrder" }),
        isHidden: columnName => new BoolColumnClient({ columnName, fieldCaptionKey: "catalog.hidden", fieldDescriptionKey: null }),
        group: columnName => new InheritedColumnClient(new GenericStringColumnClient({ columnName, fieldCaptionKey: "catalog.group", fieldDescriptionKey: null }), { fieldCaptionKey: "catalog.group" }),
        indicator: columnName => new InheritedColumnClient(new GenericStringColumnClient({ columnName, fieldCaptionKey: "catalog.indicator", fieldDescriptionKey: null }), { fieldCaptionKey: "catalog.indicator" }),
        indicatorCssClass: columnName => new InheritedColumnClient(new GenericStringColumnClient({ columnName, fieldCaptionKey: "catalog.indicatorCssClass", fieldDescriptionKey: null }), { fieldCaptionKey: "catalog.indicatorCssClass" }),
    },
});
const MainContent = () => {
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const locale = useLocale();
    return <>
        <BandLocalizedMarkdown id="editSongTags_markdown" />
        {presentation.bandPublicId ? <DB3EditGrid
            tableSpec={bandSongTagTableSpec}
            view={bandSongTagView}
            referenceProvider={dashboard.referenceStore}
        />
            : <Alert severity="info">{locale.getPlainString("catalog.selectBand")}</Alert>}
    </>;
};
const EditSongTagsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("catalog.songTags")}><MainContent /></DashboardLayout>;
};
defineCmdbPage("bandEditSongTags", EditSongTagsPage);
export default EditSongTagsPage;
