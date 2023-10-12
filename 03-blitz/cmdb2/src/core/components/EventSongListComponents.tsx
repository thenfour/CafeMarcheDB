// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import React, { FC, Suspense } from "react"
import db, { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { API, APIQueryResult } from '../db3/clientAPI';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { gIconMap } from "../db3/components/IconSelectDialog";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { EditTextField, InspectObject, ReactiveInputDialog, VisibilityControl, VisibilityValue } from "./CMCoreComponents";
import { Markdown } from "./RichTextEditor";
import { Button, DialogActions, DialogContent, DialogContentText, DialogTitle, InputBase, TextField } from "@mui/material";
import Autocomplete, { AutocompleteRenderInputParams, createFilterOptions } from '@mui/material/Autocomplete';

import { CMTextField } from "./CMTextField";
import { TAnyModel, getUniqueNegativeID } from "shared/utils";

/*
similar to other tab contents structures (see also EventSegmentComponents, EventCommentComponents...)

<tab content>
    <button + add song list> => song list editor
    <song list control>
        <song list viewer> - with edit button, maybe delete
        <song list editor>

the song list will be considered a value just like a event comment, et al. that simplifies things
regarding API and mutations etc. so instead of having tons of calls like 
- addSong
- removeSong
- reorderSong

it will just be updateSetList(song list etc.)

*/

////////////////////////////////////////////////////////////////
/*
model EventSongList {
  id          Int    @id @default(autoincrement())
  sortOrder   Int    @default(0)
  name        String
  description String @default("")

  createdByUserId     Int? // required in order to know visibility when visiblePermissionId is NULL
  createdByUser       User?       @relation(fields: [createdByUserId], references: [id], onDelete: SetDefault)
  visiblePermissionId Int? // which permission determines visibility, when NULL, only visible by admins + creator
  visiblePermission   Permission? @relation(fields: [visiblePermissionId], references: [id], onDelete: SetDefault)

  eventId Int
  event   Event @relation(fields: [eventId], references: [id], onDelete: Restrict) // when event is deleted, song lists go too.

  songs EventSongListSong[]
}

model EventSongListSong {
  id        Int     @id @default(autoincrement())
  subtitle  String? // could be a small comment like "short version"
  sortOrder Int     @default(0)

  songId Int
  song   Song @relation(fields: [songId], references: [id], onDelete: Restrict) // when you delete a song, it will disappear from all lists

  eventSongListId Int
  eventSongList   EventSongList @relation(fields: [eventSongListId], references: [id], onDelete: Cascade) // when you delete a song list, delete songs in it.
}
*/


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueViewerRowProps {
    index: number;
    value: db3.EventSongListSongPayload;
};
export const EventSongListValueViewerRow = (props: EventSongListValueViewerRowProps) => {

    const formattedBPM = (!!props.value.song?.startBPM && !!props.value.song?.startBPM) ? `${props.value.song?.startBPM || ""}⇢${props.value.song?.endBPM || ""}` : "";

    return <tr>
        <td className="minContent songIndex">{props.index}</td>
        <td>{props.value.song.name}</td>
        <td className="minContent length">{props.value.song && props.value.song.lengthSeconds}</td>
        <td className="minContent tempo" >{formattedBPM}</td>
        <td>{props.value.subtitle}</td>
    </tr>;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueViewerProps {
    value: db3.EventSongListPayload;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
};

export const EventSongListValueViewer = (props: EventSongListValueViewerProps) => {
    const [currentUser] = useCurrentUser();
    const stats = API.events.getSongListStats(props.value);
    return <div className="EventSongList viewer">
        <VisibilityValue permission={props.value.visiblePermission} />
        <Button onClick={props.onEnterEditMode}>{gIconMap.Edit()}Edit</Button>

        {stats.songCount} songs, length seconds: {stats.durationSeconds}
        {stats.songsOfUnknownDuration > 0 && <div>with {stats.songsOfUnknownDuration} songs of unknown length</div>}
        <table className="songListSongTable">
            <thead>
                <tr>
                    <th>#</th>
                    <th>song</th>
                    <th>len</th>
                    <th>tempo</th>
                    <th>comment</th>
                </tr>
            </thead>
            <tbody>
                {
                    props.value.songs.map((s, index) => <EventSongListValueViewerRow key={s.id} index={index} value={s} />)
                }
            </tbody>
        </table>



    </div>;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SongAutocompleteProps {
    // filters ? by tag for example, or sorting options?
    value: db3.SongPayload | null;
    onChange: (value: db3.SongPayload | null) => void;
};
export const SongAutocomplete = (props: SongAutocompleteProps) => {
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    const songTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xSong,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
        ],
    });

    const songTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec: songTableSpec,
        // filter options, by tag e.g.
    });

    const items: db3.SongPayload[] = songTableClient.items as any;

    const filterOptions = createFilterOptions<db3.SongPayload>({
        matchFrom: "any",
        stringify: (option) => option.name,
    });

    return <Autocomplete
        options={items}
        value={props.value}
        onChange={(event, value) => props.onChange(value)}

        fullWidth={true}// at least for table cells this makes sense.
        // open={open}
        // onClose={() => setOpen(false)} // always close when user requests it.
        // onOpen={(event) => {
        //     // only open the popup indicator arrow clicking
        //     setOpen(true);
        // }}
        // onInputChange={(_, value) => {
        //     // don't show the popup when nothing is typed. too much visual clutter.
        //     // https://stackoverflow.com/questions/69380819/hide-material-ui-autocomplete-popup-until-text-is-typed
        //     if (value.length === 0) {
        //         if (open) setOpen(false);
        //     } else {
        //         if (!open) setOpen(true);
        //     }
        // }}
        openOnFocus={false} // covers focus event but not clicks; see below for workaround

        getOptionLabel={(option) => option.name}
        filterOptions={filterOptions} // needed in order to filter objects not simple string options

        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderOption={(props, option, state) => {
            return <li {...props}>{option.name}</li>;
        }}
        renderInput={(params: AutocompleteRenderInputParams) => {
            // using autocomplete with InputBase: https://stackoverflow.com/questions/64609126/how-do-i-use-autocomplete-component-of-material-ui-with-inputbase
            const { InputLabelProps, InputProps, ...rest } = params;
            const inputProps = { ...params.InputProps, ...rest };
            if (inputProps.className) {
                inputProps.className = inputProps.className + " cmdbSimpleInput";
            } else {
                inputProps.className = "cmdbSimpleInput";
            }

            return <div className="cmdbSimpleInputWrapper">
                <InputBase
                    {...inputProps}

                    // this is required to prevent the popup from happening when you click into the text field. you must explicitly click the popup indicator.
                    // a bit of a hack/workaround but necessary https://github.com/mui/material-ui/issues/23164
                    onMouseDownCapture={(e) => e.stopPropagation()}
                />
            </div>;
        }}
    />;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueEditorRowProps {
    index: number;
    value: db3.EventSongListSongPayload;
    onChange: (newValue: db3.EventSongListSongPayload) => void;
    onDelete: () => void;
};
export const EventSongListValueEditorRow = (props: EventSongListValueEditorRowProps) => {

    const handleAutocompleteChange = (song: db3.SongPayload | null) => {
        props.value.songId = song?.id || null;
        props.value.song = song;
        props.onChange(props.value);
    }

    const handleCommentChange = (newText: string) => {
        props.value.subtitle = newText;
        props.onChange(props.value);
    };

    const formattedBPM = (!!props.value.song?.startBPM && !!props.value.song?.startBPM) ? `${props.value.song?.startBPM || ""}⇢${props.value.song?.endBPM || ""}` : "";

    return <tr>
        <td className="minContent dragHandle draggable">☰ <InspectObject src={props.value} tooltip="snth" /></td>
        <td className="minContent songIndex">{props.index}</td>
        <td className="minContent icon">{props.value.songId ? <div className="freeButton" onClick={props.onDelete}>{gIconMap.Delete()}</div> : gIconMap.Add()}</td>
        <td><SongAutocomplete onChange={handleAutocompleteChange} value={props.value.song || null} /></td>
        <td className="minContent length">{props.value.song && props.value.song.lengthSeconds}</td>
        <td className="minContent tempo">{formattedBPM}</td>
        <td>
            <InputBase
                className="cmdbSimpleInput"
                // this is required to prevent the popup from happening when you click into the text field. you must explicitly click the popup indicator.
                // a bit of a hack/workaround but necessary https://github.com/mui/material-ui/issues/23164
                onMouseDownCapture={(e) => e.stopPropagation()}
                value={props.value.subtitle}
                onChange={(e) => handleCommentChange(e.target.value)}
            />
        </td>
    </tr>;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// song list editor, but doesn't perform saving or db ops. parent component should handle that.
interface EventSongListValueEditorProps {
    initialValue: db3.EventSongListPayload;
    onSave: (newValue: db3.EventSongListPayload) => void;
    onCancel: () => void;
    onDelete?: () => void;
    rowMode: db3.DB3RowMode;
};

// state managed internally.
export const EventSongListValueEditor = (props: EventSongListValueEditorProps) => {

    const ensureHasNewRow = (list: db3.EventSongListSongPayload[]) => {
        // make sure there is at least 1 "new" item.
        if (!list.some(s => !s.songId)) {
            const id = getUniqueNegativeID(); // make sure all objects have IDs, for tracking changes
            console.log(`adding a new row id ${id}`);
            list.push({
                // create a new association model
                eventSongListId: props.initialValue.id,
                id,
                song: null,
                songId: null,
                sortOrder: 0,
                subtitle: "",
            });
        }
    };

    // make sure the caller's object doesn't get modified. esp. create a copy of the songs array so we can manipulate it.
    const initialValueCopy = { ...props.initialValue, songs: [...props.initialValue.songs] };
    ensureHasNewRow(initialValueCopy.songs);

    const [value, setValue] = React.useState<db3.EventSongListPayload>(initialValueCopy);

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSongList,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
        ],
    });

    const api: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...value, ...fieldValues };
            setValue(newValue);
        },
    };

    const validationResult = tableSpec.args.table.ValidateAndComputeDiff(value, value, props.rowMode);

    const stats = API.events.getSongListStats(value);

    const handleRowChange = (newValue: db3.EventSongListSongPayload) => {
        // replace existing with this.
        const n = { ...value };
        const index = n.songs.findIndex(s => s.id === newValue.id);
        if (index === -1) throw new Error(`id should alread be populated`);
        n.songs[index] = newValue;
        ensureHasNewRow(n.songs);
        setValue(n);
    };

    const handleRowDelete = (row: db3.EventSongListSongPayload) => {
        // replace existing with this.
        const n = { ...value };
        const index = n.songs.findIndex(s => s.id === row.id);
        if (index === -1) throw new Error(`id should alread be populated`);
        n.songs.splice(index);
        ensureHasNewRow(n.songs);
        setValue(n);
    };

    return <>
        <ReactiveInputDialog onCancel={props.onCancel} className="EventSongListValueEditor">

            <DialogTitle>
                edit song list
            </DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    description of song lists.
                </DialogContentText>

                <InspectObject src={props.initialValue} tooltip="props.initialValue" />
                <InspectObject src={initialValueCopy} tooltip="initialValueCopy" />
                <InspectObject src={value} tooltip="value" />

                {props.onDelete && <Button onClick={props.onDelete}>{gIconMap.Delete()}Delete</Button>}

                <VisibilityControl value={value.visiblePermission} onChange={(newVisiblePermission) => {
                    const newValue: db3.EventSongListPayload = { ...value, visiblePermission: newVisiblePermission, visiblePermissionId: newVisiblePermission?.id || null };
                    setValue(newValue);
                }} />

                {tableSpec.getColumn("name").renderForNewDialog!({ key: "name", row: value, validationResult, api, value: value.name })}
                {stats.songCount} songs, length seconds: {stats.durationSeconds}
                {stats.songsOfUnknownDuration > 0 && <div>with {stats.songsOfUnknownDuration} songs of unknown length</div>}

                {/*
          TITLE                  DURATION    BPM      Comment
☰ 1. 🗑 Paper Spaceships______   3:54       104 |||   ____________________
☰ 2. 🗑 Jet Begine____________   4:24       120 ||||  ____________________
   + ______________________ <-- autocomplete for new song search

                 */}

                <table className="songListSongTable">
                    <thead>
                        <tr>
                            <th></th>
                            <th>#</th>
                            <th>del</th>
                            <th>song</th>
                            <th>len</th>
                            <th>tempo</th>
                            <th>comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            value.songs.map((s, index) => <EventSongListValueEditorRow key={s.id} index={index} value={s} onChange={handleRowChange} onDelete={() => handleRowDelete(s)} />)
                        }
                    </tbody>
                </table>


            </DialogContent>
            <DialogActions>
                <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()}>Cancel</Button>
                <Button onClick={() => { props.onSave(value) }} startIcon={gIconMap.Save()}>OK</Button>
            </DialogActions>

        </ReactiveInputDialog>
    </>

        ;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// editor for existing song lists, handles db mutations & parent refetching; rendering delegated to either EventSongListValueEditor or VIewer.
//         <EventSongListControl>
//             <EventSongListValueViewer> - has an edit button to switch modes
//             <EventSongListValueEditor>
interface EventSongListControlProps {
    value: db3.EventSongListPayload;
    readonly: boolean;
    refetch: () => void;
};

export const EventSongListControl = (props: EventSongListControlProps) => {

    const [editMode, setEditMode] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const deleteMutation = API.events.deleteEventSongListx.useToken();
    const updateMutation = API.events.updateEventSongListx.useToken();

    const handleSave = (newValue: db3.EventSongListPayload) => {
        updateMutation.invoke({
            id: newValue.id,
            visiblePermissionId: newValue.visiblePermissionId,
            eventId: newValue.eventId,
            description: newValue.description,
            name: newValue.name,
            sortOrder: newValue.sortOrder,
            songs: newValue.songs.filter(s => !!s.song).map(s => ({ // new (blank) items might be in the list; filter them.
                songId: s.songId,
                sortOrder: s.sortOrder,
                subtitle: s.subtitle || "",
            }))
        }).then(() => {
            showSnackbar({ severity: "success", children: "song list edit successful" });
            props.refetch();
            setEditMode(false);
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    const handleDelete = () => {
        deleteMutation.invoke({
            id: props.value.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "song list delete successful" });
            props.refetch();
            setEditMode(false);
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    return editMode ? (
        <EventSongListValueEditor initialValue={props.value} onSave={handleSave} onDelete={handleDelete} onCancel={() => setEditMode(false)} rowMode="update" />
    ) : (
        <EventSongListValueViewer value={props.value} onEnterEditMode={() => setEditMode(true)} />
    );
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for new song lists. different from the other editor because this doesn't save automatically, it only saves after you click "save"
interface EventSongListNewEditorProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    onCancel: () => void;
    onSuccess: () => void;
};

export const EventSongListNewEditor = (props: EventSongListNewEditorProps) => {

    const insertMutation = API.events.insertEventSongListx.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [currentUser] = useCurrentUser();
    const clientIntention: db3.xTableClientUsageContext = {
        intention: 'user',
        mode: 'primary',
        currentUser: currentUser!,
    };
    const initialValue = db3.xEventSongList.createNew(clientIntention) as db3.EventSongListPayload;

    const handleSave = (value: db3.EventSongListPayload) => {
        insertMutation.invoke({
            visiblePermissionId: value.visiblePermissionId,
            eventId: props.event.id,
            description: value.description,
            name: value.name,
            sortOrder: value.sortOrder,
            songs: value.songs.filter(s => !!s.song).map(s => ({ // new (blank) items might be in the list; filter them.
                songId: s.songId,
                sortOrder: s.sortOrder,
                subtitle: s.subtitle || "",
            }))
        }).then(() => {
            showSnackbar({ severity: "success", children: "added new song list" });
            props.onSuccess();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    return <EventSongListValueEditor onSave={handleSave} initialValue={initialValue} onCancel={props.onCancel} rowMode="new" />
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventSongListList = ({ event, tableClient }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient }) => {
    return <div className="EventSongListList">
        {event.songLists.map(c => <EventSongListControl key={c.id} value={c} readonly={false} refetch={tableClient.refetch} />)}
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventSongListTabContent = ({ event, tableClient }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient }) => {
    const [newOpen, setNewOpen] = React.useState<boolean>(false);
    return <div className="EventSongListTabContent">
        {newOpen && (
            <EventSongListNewEditor event={event} tableClient={tableClient} onCancel={() => setNewOpen(false)} onSuccess={() => { setNewOpen(false); tableClient.refetch(); }} />
        )}
        <div className="addButtonContainer"><Button onClick={() => setNewOpen(true)}>{gIconMap.Add()} Add new song list</Button></div>
        <EventSongListList event={event} tableClient={tableClient} />
    </div>;
};

