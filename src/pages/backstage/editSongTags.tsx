import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import type { BlitzPage } from "@blitzjs/next";
import { Alert } from "@mui/material";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { bandSongTagView } from "src/core/db3/shared/entities/song/bandSongTagViews";
import { defineTableClientSpec } from "src/core/db3/components/DB3ClientCore";
import { GenericStringColumnClient, GenericIntegerColumnClient, ColorColumnClient, BoolColumnClient } from "src/core/db3/components/DB3ClientBasicFields";
import { LocalizedStringColumnClient, InheritedColumnClient, catalogColumn } from "src/core/db3/components/DB3CatalogFields";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

export const bandSongTagTableSpec = defineTableClientSpec({
    view: bandSongTagView,
    columns: {
        name: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        color: columnName => new InheritedColumnClient(new ColorColumnClient({ columnName, cellWidth: 250 }), { fieldCaptionKey: "catalog.color" }),
        sortOrder: columnName => new InheritedColumnClient(new GenericIntegerColumnClient({ columnName, cellWidth: 80 }), { fieldCaptionKey: "catalog.sortOrder" }),
        isHidden: columnName => catalogColumn(new BoolColumnClient({ columnName }), "catalog.hidden"),
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
        <LocalizedMarkdown setting="editSongTags_markdown" />
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
export default EditSongTagsPage;


// MIGRATION_RESTORE: catalog-help
// Source: c4df4fe07549d210e476ef5f0d24731bdf338a67:src/pages/backstage/editSongTags.tsx:1-42
// Reason: The song-tag editor replacement dropped its configured help Markdown.
// Restore: Restore edit-song-tag help content through localized Markdown without losing the migrated catalog editor.
// Verification: Verify the configured help is rendered in the selected locale and band alongside the song-tag editor.
// SHA256: 853d987f30c5e4468e513900dc0b27c654163c7c2bef7a747798555404aee075
// MIGRATION_REFERENCE_BEGIN
//
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { BlitzPage } from "@blitzjs/next";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
// import * as db3 from "src/core/db3/db3";
// import * as DB3Client from "src/core/db3/DB3Client";
//
//
// const songTagsTableSpec = DB3Client.defineTableClientSpec({
//     view: db3.songTagEditorView,
//     columns: {
//         publicId: DB3Client.publicIdFieldGen(),
//         text: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
//         description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
//         color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 300 }),
//         sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
//         group: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
//         indicator: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
//         indicatorCssClass: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
//     },
// });
//
//
// const MainContent = () => {
//     return <>
//         <LocalizedMarkdown setting="editSongTags_markdown"></LocalizedMarkdown>
//         <DB3EditGrid tableSpec={songTagsTableSpec} view={db3.songTagEditorView} />
//     </>;
// };
//
//
// const EditSongTagsPage: BlitzPage = () => {
//
//     return (
//         <DashboardLayout title="Song Tags">
//             <MainContent />
//         </DashboardLayout>
//     )
// }
//
// export default EditSongTagsPage;
// MIGRATION_REFERENCE_END
