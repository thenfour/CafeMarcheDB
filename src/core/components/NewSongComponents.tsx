import { BlitzPage } from "@blitzjs/next";
import {
    Search as SearchIcon
} from '@mui/icons-material';
import { InputBase } from "@mui/material";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel, gQueryOptions, toggleValueInArray } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMChip, CMChipContainer, CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { SongClientColumns, SongDetail, SongDetailContainer, SongMetadataView } from "src/core/components/SongComponents";
import { CalculateSongMetadata } from "src/core/components/SongComponentsBase";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { DB3EditRowButton, DB3EditRowButtonAPI } from "src/core/db3/components/db3NewObjectDialog";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { DashboardContext } from './DashboardContext';
import { SearchableNameColumnClient } from "./SearchableNameColumnClient";

export const NewSongButton = () => {
    const router = useRouter();
    const dashboardContext = React.useContext(DashboardContext);

    if (!useAuthorization("ViewSongsPage", Permission.manage_songs)) {
        return null;
    }

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    const emptyRow = (() => {
        const ret = db3.xSong.createNew(clientIntention);
        // default to members visibility.
        // note: you cannot use API....defaultVisibility because that uses a hook and this is a callback.
        ret.visiblePermission = dashboardContext.permissions.find(p => p.significance === db3.PermissionSignificance.Visibility_Members) || null;
        return ret;
    })();

    // song table bindings
    const songTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xSong,
        columns: [
            SongClientColumns.id,
            SongClientColumns.name,
            //new SearchableNameColumnClient({ columnName: "name", cellWidth: 250 }),
            SongClientColumns.aliases,
            SongClientColumns.slug,
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200, visible: false }), // required field but it's distracting to see here.
            SongClientColumns.startBPM,
            SongClientColumns.endBPM,
            SongClientColumns.introducedYear,
            SongClientColumns.lengthSeconds,
            SongClientColumns.tags,
            //SongClientColumns.createdByUser,
            SongClientColumns.visiblePermission,
        ],
    });

    // necessary to connect all the columns in the spec.
    const songTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Mutation,
        tableSpec: songTableSpec,
    });

    const handleSave = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        songTableClient.doInsertMutation(obj).then(async (ret) => {
            showSnackbar({ severity: "success", children: "success" });
            void router.push(API.songs.getURIForSong((ret as any).id));
            api.closeDialog();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error" });
        });
    };

    return <DB3EditRowButton
        onSave={handleSave}
        tableRenderClient={songTableClient}
        row={emptyRow}
        label={<>{gIconMap.Add()} Create new song</>}
    />;
};
