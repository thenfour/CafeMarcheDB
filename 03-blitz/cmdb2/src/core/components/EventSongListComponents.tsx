// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { useAuthenticatedSession } from '@blitzjs/auth';
import { Button, Checkbox, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputBase } from "@mui/material";
import Autocomplete, { AutocompleteRenderInputParams, createFilterOptions } from '@mui/material/Autocomplete';
import { assert } from 'blitz';
import { Prisma } from "db";
import React from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { StandardVariationSpec } from 'shared/color';
import { formatSongLength } from 'shared/time';
import { TAnyModel, getUniqueNegativeID, moveItemInArray } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gIconMap } from "../db3/components/IconSelectDialog";
import { CMChipContainer, CMStandardDBChip, ReactSmoothDndContainer, ReactSmoothDndDraggable, ReactiveInputDialog } from "./CMCoreComponents";
import { CMDialogContentText } from './CMCoreComponents2';
import { Markdown } from "./RichTextEditor";

// make song nullable for "add new item" support
type EventSongListNullableSong = Prisma.EventSongListSongGetPayload<{
    select: {
        eventSongListId: true,
        subtitle: true,
        id: true,
        sortOrder: true,
    }
}> & {
    songId: null | number;
    song: null | db3.SongPayload;
};

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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueViewerRowProps {
    index: number;
    value: db3.EventSongListSongPayload;
    showTags: boolean;
};
export const EventSongListValueViewerRow = (props: EventSongListValueViewerRowProps) => {

    const formattedBPM = props.value.song ? API.songs.getFormattedBPM(props.value.song) : "";

    return <div className={`tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} ${props.value.songId === null ? 'invalidItem' : 'validItem'}`}>
        <div className="td songIndex">{props.index + 1}
            {/* id:{props.value.id} so:{props.value.sortOrder} */}
        </div>
        <div className="td songName">
            <a target='_blank' href={API.songs.getURIForSong(props.value.song)}>{props.value.song.name}</a>
        </div>
        <div className="td length">{props.value.song?.lengthSeconds && formatSongLength(props.value.song.lengthSeconds)}</div>
        <div className="td tempo">{formattedBPM}</div>
        <div className="td comment">
            <div className="comment">{props.value.subtitle}</div>
            {/* <div className="CMChipContainer comment2"></div> */}
            {props.showTags && (props.value.song.tags.length > 0) && (
                <CMChipContainer>
                    {props.value.song.tags.filter(a => a.tag.showOnSongLists).map(a => <CMStandardDBChip key={a.id} model={a.tag} size="small" variation={StandardVariationSpec.Weak} />)}
                </CMChipContainer>
            )}
        </div>
    </div>

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface EventSongListValueViewerProps {
    value: db3.EventSongListPayload;
    readonly: boolean;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
};

export const EventSongListValueViewer = (props: EventSongListValueViewerProps) => {
    //const [currentUser] = useCurrentUser();
    const [showTags, setShowTags] = React.useState<boolean>(true);
    //const visInfo = API.users.getVisibilityInfo(props.value);

    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const editAuthorized = db3.xEventSongList.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: props.value,
    });



    const stats = API.events.getSongListStats(props.value);
    return <div className={`EventSongListValue EventSongListValueViewer`}>

        <div className="header">

            <div className={`columnName-name ${editAuthorized && "draggable dragHandle"}`}>
                {editAuthorized && <div className="dragHandleIcon ">☰</div>}
                {props.value.name}
            </div>
            {!props.readonly && editAuthorized && <Button onClick={props.onEnterEditMode}>{gIconMap.Edit()}Edit</Button>}

        </div>
        <div className="content">

            <Markdown markdown={props.value.description} />

            <div className="songListSongTable">
                <div className="thead">
                    <div className="tr">
                        <div className="th songIndex">#</div>
                        <div className="th songName">Song</div>
                        <div className="th length">Length</div>
                        <div className="th tempo">Tempo</div>
                        <div className="th comment">
                            Comment
                            <FormControlLabel className='CMFormControlLabel'
                                control={<Checkbox size="small" checked={showTags} onClick={() => setShowTags(!showTags)} />} label="Show tags" />
                        </div>
                    </div>
                </div>

                <div className="tbody">
                    {
                        props.value.songs.map((s, index) => <EventSongListValueViewerRow key={s.id} index={index} value={s} showTags={showTags} />)
                    }

                </div>
            </div>

            <div className="stats CMSidenote">
                {stats.songCount} songs,
                length: {formatSongLength(stats.durationSeconds)}
                {stats.songsOfUnknownDuration > 0 && <> (with {stats.songsOfUnknownDuration} song(s) of unknown length)</>}
            </div>
        </div>
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

        fullWidth={true}
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
            return <li className="songDropdownOption" {...props}>{option.name}</li>;
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
    value: EventSongListNullableSong;
    showTags: boolean;
    onChange: (newValue: EventSongListNullableSong) => void;
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

    const formattedBPM = props.value.song ? API.songs.getFormattedBPM(props.value.song) : "";

    return <>
        <div className={`tr ${props.value.id <= 0 ? 'newItem' : 'existingItem'} ${props.value.songId === null ? 'invalidItem' : 'validItem'}`}>
            <div className="td dragHandle draggable">☰
                {/* <InspectObject src={props.value} tooltip="snth" /> */}
            </div>
            <div className="td songIndex">{props.index + 1}
                {/* id:{props.value.id} so:{props.value.sortOrder} */}
            </div>
            <div className="td icon">{props.value.songId ? <div className="freeButton" onClick={props.onDelete}>{gIconMap.Delete()}</div> : gIconMap.Add()}</div>
            <div className="td songName">
                <SongAutocomplete onChange={handleAutocompleteChange} value={props.value.song || null} />
            </div>
            <div className="td length">{props.value.song?.lengthSeconds && formatSongLength(props.value.song.lengthSeconds)}</div>
            <div className="td tempo">{formattedBPM}</div>
            {/* </div>
        <div className="tr"> */}
            <div className="td comment">
                <div className="comment">
                    <InputBase
                        className="cmdbSimpleInput"
                        placeholder="Comment"
                        // this is required to prevent the popup from happening when you click into the text field. you must explicitly click the popup indicator.
                        // a bit of a hack/workaround but necessary https://github.com/mui/material-ui/issues/23164
                        onMouseDownCapture={(e) => e.stopPropagation()}
                        value={props.value.subtitle}
                        onChange={(e) => handleCommentChange(e.target.value)}
                    />
                </div>
                {props.showTags && props.value.song && props.value.song.tags.length > 0 && (
                    <CMChipContainer>
                        {props.value.song.tags.filter(a => a.tag.showOnSongLists).map(a => <CMStandardDBChip key={a.id} model={a.tag} variation={StandardVariationSpec.Weak} size="small" />)}
                    </CMChipContainer>
                )}
            </div>
        </div>
    </>;
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
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    const ensureHasNewRow = (list: EventSongListNullableSong[]) => {
        // make sure there is at least 1 "new" item.
        if (!list.some(s => !s.songId)) {
            const id = getUniqueNegativeID(); // make sure all objects have IDs, for tracking changes
            const sortOrders = list.map(song => song.sortOrder);
            const newSortOrder = 1 + Math.max(0, ...sortOrders);
            list.push({
                // create a new association model
                eventSongListId: props.initialValue.id,
                id,
                song: null,
                songId: null,
                sortOrder: newSortOrder,
                subtitle: "",
            });
        }
    };
    const [showTags, setShowTags] = React.useState<boolean>(false);

    // make sure the caller's object doesn't get modified. esp. create a copy of the songs array so we can manipulate it. any refs we modify should not leak outside of this component.
    const initialValueCopy = { ...props.initialValue, songs: [...props.initialValue.songs.map(s => ({ ...s }))] };
    ensureHasNewRow(initialValueCopy.songs);

    const [value, setValue] = React.useState<db3.EventSongListPayload>(initialValueCopy);

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSongList,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 200 }),
        ],
    });

    // necessary to connect columns.
    const ctx__ = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None, // i don't think it's necessary to do this when i'm just connecting columns.
        tableSpec: tableSpec,
    });

    const api: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...value, ...fieldValues };
            setValue(newValue);
        },
    };

    const validationResult = tableSpec.args.table.ValidateAndComputeDiff(value, value, props.rowMode, clientIntention);

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

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        //console.log(args);
        value.songs = moveItemInArray(value.songs, args.removedIndex, args.addedIndex).map((song, index) => ({ ...song, sortOrder: index }));
        setValue({ ...value });
        //setItems(items => arrayMove(items, removedIndex, addedIndex));
    };

    return <>
        <ReactiveInputDialog onCancel={props.onCancel} className="EventSongListValueEditor">

            <DialogTitle>
                edit song list
            </DialogTitle>
            <DialogContent dividers>
                <CMDialogContentText>
                    description of song lists.
                </CMDialogContentText>

                <div className="EventSongListValue">

                    {/* <VisibilityControl value={value.visiblePermission} onChange={(newVisiblePermission) => {
                        const newValue: db3.EventSongListPayload = { ...value, visiblePermission: newVisiblePermission, visiblePermissionId: newVisiblePermission?.id || null };
                        setValue(newValue);
                    }} /> */}

                    <div className="flex-spacer"></div>

                    {props.onDelete && <Button onClick={props.onDelete}>{gIconMap.Delete()}Delete</Button>}

                    {tableSpec.getColumn("name").renderForNewDialog!({ key: "name", row: value, validationResult, api, value: value.name, clientIntention })}
                    {tableSpec.getColumn("description").renderForNewDialog!({ key: "description", row: value, validationResult, api, value: value.description, clientIntention })}
                    {tableSpec.getColumn("sortOrder").renderForNewDialog!({ key: "sortOrder", row: value, validationResult, api, value: value.sortOrder, clientIntention })}

                    {/*
          TITLE                  DURATION    BPM      Comment
☰ 1. 🗑 Paper Spaceships______   3:54       104 |||   ____________________
☰ 2. 🗑 Jet Begine____________   4:24       120 ||||  ____________________
   + ______________________ <-- autocomplete for new song search

   drag & drop is not supported by HTML tables.
   even though you can technically render the components (<container / draggable>) as table elements, dragging won't work.
   we don't even get the dragstart/end/etc events.

   best to stick to <div>s; fortunately:
   - we have few columns and only the song title is really essential; others can be fixed width
   - this grants us more reactive-friendly behaviors

                 */}

                    <div className="songListSongTable">
                        <div className="thead">
                            <div className="tr">
                                <div className="th dragHandle"></div>
                                <div className="th songIndex">#</div>
                                <div className="th icon"></div>
                                <div className="th songName">Song</div>
                                <div className="th length">Length</div>
                                <div className="th tempo">Tempo</div>
                                <div className="th comment">
                                    Comment
                                    <FormControlLabel className='CMFormControlLabel'
                                        control={<Checkbox size="small" checked={showTags} onClick={() => setShowTags(!showTags)} />} label="Show tags" />
                                </div>
                            </div>
                        </div>
                        <ReactSmoothDndContainer
                            dragHandleSelector=".dragHandle"
                            lockAxis="y"
                            onDrop={onDrop}
                        >
                            {
                                value.songs.map((s, index) => <ReactSmoothDndDraggable key={s.id}>
                                    <EventSongListValueEditorRow key={s.id} index={index} value={s} onChange={handleRowChange} onDelete={() => handleRowDelete(s)} showTags={showTags} />
                                </ReactSmoothDndDraggable>
                                )
                            }
                        </ReactSmoothDndContainer>
                    </div>

                    <div className="stats">
                        {stats.songCount} songs, length: {formatSongLength(stats.durationSeconds)}
                        {stats.songsOfUnknownDuration > 0 && <div>(with {stats.songsOfUnknownDuration} songs of unknown length)</div>}
                    </div>
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()}>Cancel</Button>
                <Button onClick={() => { props.onSave(value) }} startIcon={gIconMap.Save()}>OK</Button>
            </DialogActions>

        </ReactiveInputDialog>
    </>;
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
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const editAuthorized = db3.xEventSongList.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: props.value,
    });

    const deleteMutation = API.events.deleteEventSongListx.useToken();
    const updateMutation = API.events.updateEventSongListx.useToken();

    const handleSave = (newValue: db3.EventSongListPayload) => {
        updateMutation.invoke({
            id: newValue.id,
            //visiblePermissionId: newValue.visiblePermissionId,
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

    return <>
        {!props.readonly && editAuthorized && editMode && <EventSongListValueEditor initialValue={props.value} onSave={handleSave} onDelete={handleDelete} onCancel={() => setEditMode(false)} rowMode="update" />}
        <EventSongListValueViewer readonly={props.readonly} value={props.value} onEnterEditMode={() => setEditMode(true)} />
    </>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for new song lists. different from the other editor because this doesn't save automatically, it only saves after you click "save"
interface EventSongListNewEditorProps {
    event: db3.EventClientPayload_Verbose;
    //tableClient: DB3Client.xTableRenderClient;
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
    initialValue.name = `Set ${props.event.songLists.length + 1}`;

    const handleSave = (value: db3.EventSongListPayload) => {
        insertMutation.invoke({
            //visiblePermissionId: value.visiblePermissionId,
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
export const EventSongListList = ({ event, tableClient, readonly, refetch }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient, readonly: boolean, refetch: () => void }) => {
    const [saving, setSaving] = React.useState<boolean>(false);

    const updateSortOrderMutation = API.other.updateGenericSortOrderMutation.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        setSaving(true);
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        const movingItemId = event.songLists[args.removedIndex]!.id;
        const newPositionItemId = event.songLists[args.addedIndex]!.id;
        assert(!!movingItemId && !!newPositionItemId, "moving item not found?");

        updateSortOrderMutation.invoke({
            tableID: db3.xEventSongList.tableID,
            tableName: db3.xEventSongList.tableName,
            movingItemId,
            newPositionItemId,
        }).then(() => {
            showSnackbar({ severity: "success", children: "song list reorder successful" });
            refetch();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "reorder error; see console" });
        }).finally(() => {
            setSaving(false);
        });

    };

    return <div className={`EventSongListList ${saving && "saving"}`}>
        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >
            {event.songLists.map(c => (
                <ReactSmoothDndDraggable key={c.id}>
                    <EventSongListControl key={c.id} value={c} readonly={false} refetch={refetch} />
                </ReactSmoothDndDraggable>
            ))}
        </ReactSmoothDndContainer>
    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventSongListTabContent = ({ event, tableClient, readonly, refetch }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient, readonly: boolean, refetch: () => void }) => {
    const [newOpen, setNewOpen] = React.useState<boolean>(false);
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const insertAuthorized = db3.xEventSongList.authorizeRowBeforeInsert({
        clientIntention,
        publicData,
    });

    return <div className="EventSongListTabContent">
        {insertAuthorized && !readonly && <Button className='addNewSongListButton' onClick={() => setNewOpen(true)}>{gIconMap.Add()} Add new song list</Button>}
        {newOpen && !readonly && insertAuthorized && (
            <EventSongListNewEditor event={event} onCancel={() => setNewOpen(false)} onSuccess={() => { setNewOpen(false); refetch(); }} />
        )}
        <EventSongListList event={event} tableClient={tableClient} readonly={readonly} refetch={refetch} />
    </div>;
};

