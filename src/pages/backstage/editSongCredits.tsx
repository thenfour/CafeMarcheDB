import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import { Alert } from "@mui/material";
import { useRouter } from "next/router";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { Localized } from "@/src/locale/components/Localized";
import { useLocale } from "src/locale/components/useLocale";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";

const MainContent = () => {
    const router = useRouter();
    const locale = useLocale();
    const requestedSongId = router.query.songId;
    const songId = requestedSongId === undefined ? null : db3.xSong.identitySchema.safeParse(requestedSongId);
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.songCreditEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            user: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.member", selectionView: db3.bandPersonReferenceView }),
            song: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.song", selectionView: db3.songReferenceView }),
            type: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.creditType", selectionView: db3.songCreditTypeEditorView, selectStyleSettingKey: "global.ui.songCredit.type.selectStyle" }),
            year: columnName => new DB3Client.GenericStringColumnClient({ columnName, fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.year" }),
            comment: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.comment" }),
        },
    });
    if (songId && !songId.success) {
        return <Alert severity="error">{locale.getPlainString("songCredits.invalidSong")}</Alert>;
    }
    return <>
        <Localized id="EditSongCreditsPage_markdown" />
        <DB3EditGrid tableSpec={tableSpec} view={db3.songCreditEditorView} tableParams={{ songId: songId?.data ?? null }} />
    </>;
};

const EditSongCreditsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("songCredits.title")}><MainContent /></DashboardLayout>;
};
defineCmdbPage("bandEditSongCredits", EditSongCreditsPage);
export default EditSongCreditsPage;
