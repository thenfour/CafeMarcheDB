import { TAnyModel } from "@/shared/rootroot";
import { useRouter } from "next/router";
import React from "react";
import { Permission } from "shared/permissions";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { SongClientColumns } from "src/core/components/song/SongComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditRowButton, DB3EditRowButtonAPI } from "src/core/db3/components/db3NewObjectDialog";
import * as db3 from "src/core/db3/db3";
import { gIconMap } from "../../db3/components/IconMap";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export const NewSongButton = () => {
    const router = useRouter();
    const dashboardContext = useDashboardContext();

    if (!dashboardContext.isAuthorized(Permission.manage_songs)) {
        return null;
    }

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const currentUser = useCurrentUser()[0]!;


    const emptyRow = (() => {
        const ret = db3.xSong.createNew(currentUser);
        // default to members visibility.
        // note: you cannot use API....defaultVisibility because that uses a hook and this is a callback.
        ret.visiblePermission = dashboardContext.getDefaultVisibilityPermission();
        return ret;
    })();

    // song table bindings
    const songTableSpec = DB3Client.defineTableClientSpec({
        view: db3.songEditorView,
        columns: {
            ...DB3Client.makeClientColumnSelection(
                SongClientColumns.publicId,
                SongClientColumns.name,
                //new SearchableNameColumnClient({ columnName: "name", cellWidth: 250 }),
                SongClientColumns.aliases,
                //SongClientColumns.slug,
            ),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200, visible: false }), // required field but it's distracting to see here.
            ...DB3Client.makeClientColumnSelection(
                SongClientColumns.startBPM,
                SongClientColumns.endBPM,
                SongClientColumns.introducedYear,
                SongClientColumns.lengthSeconds,
                SongClientColumns.tags,
                //SongClientColumns.createdByUser,
                SongClientColumns.visiblePermission,
            ),
        },
    });

    // necessary to connect all the columns in the spec.
    const songTableClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: songTableSpec,
        referenceProvider: dashboardContext.referenceStore,
    });
    const songCommands = DB3Client.useCrudViewCommands({
        view: db3.songEditorView,
        tableClient: songTableClient,
    });

    const handleSave = (obj: TAnyModel, api: DB3EditRowButtonAPI) => {
        // DB3EditRowButton still exposes its transitional untyped draft. The
        // view-bound table client proves the row expected by this CRUD command.
        songCommands.create(obj as db3.ClientOf<typeof db3.songEditorView>).then(async result => {
            showSnackbar({ severity: "success", children: "success" });
            void router.push(dashboardContext.routingApi.getURIForSong({
                publicId: result.identity,
                name: obj.name,
            }));
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
        label={<>{gIconMap.Add()} Add a song</>}
    />;
};
