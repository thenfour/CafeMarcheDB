
import { useAuthenticatedSession } from '@blitzjs/auth';
import React from "react";
import { TAnyModel } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { DB3EditRowButton, DB3EditRowButtonAPI } from '../db3/components/db3NewObjectDialog';
import { CMStandardDBChip, UserChip } from "./CMCoreComponents";
import { Markdown } from "./RichTextEditor";



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface AddSongCreditsButtonProps {
    song: db3.SongPayload_Verbose;
    readonly: boolean;
    refetch: () => void;
};

export const AddSongCreditsButton = (props: AddSongCreditsButtonProps) => {

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const user = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };
    const publicData = useAuthenticatedSession();

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xSongCredit,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "type", cellWidth: 120, }),
            new DB3Client.GenericStringColumnClient({ columnName: "year", cellWidth: 120 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "comment", cellWidth: 120 }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "song", cellWidth: 120, visible: false }),
        ],
    });

    const tableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Mutation,
        tableSpec,
    });

    // const refetch = () => {
    //     tableClient.refetch();
    //     props.refetch();
    // }

    const handleSave = (updateObj: TAnyModel, api: DB3EditRowButtonAPI) => {
        tableClient.doInsertMutation(updateObj).then(e => {
            showSnackbar({ severity: "success", children: "updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating" });
        }).finally(async () => {
            tableClient.refetch();
            props.refetch();
            api.closeDialog();
        });
    };

    const newObj = db3.xSongCredit.createNew(clientIntention);
    newObj.song = props.song;
    newObj.songId = props.song.id;
    newObj.year = `${(new Date()).getFullYear()}`;

    const insertAuthorized = db3.xEventSongList.authorizeRowBeforeInsert({
        clientIntention,
        publicData,
    });

    return <div className='songCreditsContainer'>
        {insertAuthorized && !props.readonly && <DB3EditRowButton
            onSave={handleSave}
            row={newObj}
            tableRenderClient={tableClient}
            label={`Add song credit`}
        />}
    </div>;
};

