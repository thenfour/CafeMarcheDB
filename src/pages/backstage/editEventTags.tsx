import { defineCmdbPage } from "src/route/cmdbPage";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import type { BlitzPage } from "@blitzjs/next";
import { Alert } from "@mui/material";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { bandEventTagView, globalEventTagView } from "src/core/db3/shared/entities/event/eventTagCatalogs";
import { defineTableClientSpec } from "src/core/db3/components/DB3ClientCore";
import { GenericIntegerColumnClient, ColorColumnClient, BoolColumnClient } from "src/core/db3/components/DB3ClientBasicFields";
import { LocalizedStringColumnClient, InheritedColumnClient } from "src/core/db3/components/DB3CatalogFields";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

export const bandEventTagTableSpec = defineTableClientSpec({
    view: bandEventTagView,
    columns: {
        name: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        color: columnName => new InheritedColumnClient(new ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "catalog.color", columnName, cellWidth: 250 }), { fieldCaptionKey: "catalog.color" }),
        sortOrder: columnName => new InheritedColumnClient(new GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "catalog.sortOrder", columnName, cellWidth: 80 }), { fieldCaptionKey: "catalog.sortOrder" }),
        isHidden: columnName => new BoolColumnClient({ columnName, fieldCaptionKey: "catalog.hidden", fieldDescriptionKey: null }),
    },
});
export const globalEventTagTableSpec = defineTableClientSpec({
    view: globalEventTagView,
    columns: {
        name: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        color: columnName => new ColorColumnClient({ columnName, fieldCaptionKey: "catalog.color", fieldDescriptionKey: null, cellWidth: 250 }),
        sortOrder: columnName => new GenericIntegerColumnClient({ columnName, fieldCaptionKey: "catalog.sortOrder", fieldDescriptionKey: null, cellWidth: 80 }),
        visibleOnFrontpage: columnName => new BoolColumnClient({ columnName, fieldCaptionKey: "db3.fields.visibleOnFrontpage", fieldDescriptionKey: null }),
    },
});
export const EventTagCatalogContent = () => {
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const locale = useLocale();
    return <>
        <BandLocalizedMarkdown id="EditEventTagsPage_markdown" />
        {presentation.bandPublicId && <Alert severity="info">{locale.getPlainString("catalog.eventTagsSharedDefaults")}</Alert>}
        {presentation.bandPublicId ? <DB3EditGrid
            tableSpec={bandEventTagTableSpec} view={bandEventTagView}
            referenceProvider={dashboard.referenceStore}
        /> : <DB3EditGrid
            tableSpec={globalEventTagTableSpec} view={globalEventTagView}
            referenceProvider={dashboard.referenceStore}
        />}
    </>;
};
const EditEventTagsPage: BlitzPage = () => {
    const locale = useLocale();
    const presentation = usePresentation();
    return <DashboardLayout title={locale.getPlainString(presentation.bandPublicId ? "catalog.eventTags" : "catalog.globalEventTags")}><EventTagCatalogContent /></DashboardLayout>;
};
defineCmdbPage("bandEditEventTags", EditEventTagsPage);
export default EditEventTagsPage;
