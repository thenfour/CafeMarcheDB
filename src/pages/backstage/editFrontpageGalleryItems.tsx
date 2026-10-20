import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { galleryColumnSelection } from "src/core/components/file/GalleryColumns";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { Localized } from "@/src/locale/components/Localized";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";

function EditFrontpageGalleryItemsPage() {
    const context = useDB3QueryContext();
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.frontpageGalleryItemEditorView,
        columns: galleryColumnSelection
    });
    return <DashboardLayout title="Gallery">
        <Localized id="EditFrontpageGalleryItemsPage_markdown" />
        <DB3EditGrid
            key={`${context.bandPublicId}:${context.routeLocale}`}
            tableSpec={tableSpec}
            view={db3.frontpageGalleryItemEditorView}
        />
    </DashboardLayout>;
}

defineCmdbPage("bandEditFrontpageGalleryItems", EditFrontpageGalleryItemsPage);
export default EditFrontpageGalleryItemsPage;
