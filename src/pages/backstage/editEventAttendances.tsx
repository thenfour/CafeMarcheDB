import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { Localized } from "@/src/setting/client/components/SettingMarkdown";
import { BlitzPage } from "@blitzjs/next";
import * as DB3Client from "src/core/db3/DB3Client";
import { GlobalCatalogContext } from "src/core/db3/components/GlobalCatalogContext";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import { useLocale } from "src/locale/components/useLocale";



const MainContent = () => {
    //const dashboardContext = React.useContext(DashboardContext);

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.eventAttendanceEditorView,
        columns: {
            isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
            buttonCaption: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.label", columnName }),
            personalCaption: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.personalText", columnName }),
            pastCaption: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.pastText", columnName }),
            personalPastCaption: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.pastPersonalText", columnName }),
            description: columnName => new DB3Client.LocalizedStringColumnClient({ fieldCaptionKey: "db3.fields.description", columnName }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, cellWidth: 80 }),
            isActive: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.active", columnName }),
            iconName: columnName => new DB3Client.IconFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.icon", columnName, cellWidth: 120 }),
            color: columnName => new DB3Client.ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.color", columnName, cellWidth: 300 }),
            strength: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.attendanceStrength", cellWidth: 90, columnName }),
        },
    });

    return <>
        <Localized id="EditEventAttendancesPage_markdown" />
        <GlobalCatalogContext><DB3EditGrid tableSpec={tableSpec} view={db3.eventAttendanceEditorView} /></GlobalCatalogContext>
    </>;
};


const EditEventAttendancesPage: BlitzPage = () => {
    const locale = useLocale();
    return (
        <DashboardLayout title={locale.getPlainString("eventCatalog.attendance.title")}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventAttendancesPage;
