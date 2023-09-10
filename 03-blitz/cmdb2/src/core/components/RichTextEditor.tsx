//'use client'

// <Markdown> = rendered markdown text (simple read only html)
// <MarkdownEditor> = just the text editor which outputs markdown
// <MarkdownControl> = full editor with debounced commitment (caller actually commits), displays saving indicator, switch between edit/view

// todo: autocomplete routes (events, songs) [[]]
// todo: autocomplete mentions
// todo: paste attachments
// todo: drop attachments

import {
    DeleteOutlined as DeleteIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { Box, Button, ButtonGroup, CircularProgress, TextField } from "@mui/material";
import MarkdownIt from 'markdown-it';
import React from "react";
import useDebounce from "shared/useDebounce";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import "@webscopeio/react-textarea-autocomplete/style.css";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const Markdown = (props: { markdown: string | null }) => {
    const md = new MarkdownIt;
    return <div className='renderedContent'>
        <div dangerouslySetInnerHTML={{ __html: md.render(props.markdown || "") }}></div>
    </div >;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MarkdownEditorProps {
    value: string | null, // value which may be coming from the database.
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
}

export function MarkdownEditor(props: MarkdownEditorProps) {
    const Item = ({ entity: { name, char } }) => <div>{`${name}: ${char}`}</div>;
    const Loading = ({ data }) => <div>Loading</div>;

    return (
        <ReactTextareaAutocomplete
            containerClassName="editorContainer"
            loadingComponent={Loading}
            //ref={rta => setRta(rta)}
            //innerRef={textarea => setTa(textarea)}
            containerStyle={{
                //marginTop: 20,
            }}
            //movePopupAsYouType={true}
            value={props.value || ""}
            height={400}
            onChange={props.onValueChanged}
            minChar={0} // how many chars AFTER the trigger char you need to type before the popup arrives
            trigger={{
                "@": {
                    dataProvider: token => {
                        return [
                            { name: "smile", char: "🙂" },
                            { name: "heart", char: "❤️" }
                        ];
                    },
                    component: Item,
                    output: (item, trigger) => item.char
                }
            }}
        />
    );
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// must be uncontrolled because of the debouncing. if caller sets the value, then debounce is not possible.
interface MarkdownControlProps {
    initialValue: string | null, // value which may be coming from the database.
    onValueChanged: (val: string | null) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds: number,
}

export function MarkdownControl(props: MarkdownControlProps) {
    const [valueState, setValueState] = React.useState<string | null>(props.initialValue);
    const [firstUpdate, setFirstUpdate] = React.useState<boolean>(true);
    const [isDebouncing, setIsDebouncing] = React.useState<boolean>(false);
    const debouncedMarkdown = useDebounce<string | null>(valueState, props.debounceMilliseconds); // 

    const saveNow = () => {
        setIsDebouncing(false);
        if (firstUpdate && debouncedMarkdown === props.initialValue) {
            setFirstUpdate(false);
            return; // avoid onchange when the control first loads and sets debounced state.
        }
        props.onValueChanged(debouncedMarkdown);
    };

    React.useEffect(saveNow, [debouncedMarkdown]);

    const onChange = (e) => {
        const newval = e.target.value;
        setIsDebouncing(true);
        setValueState(newval);
    };

    const [showingEditor, setShowingEditor] = React.useState<boolean>(false);

    return (
        <div className={`richTextContainer ${showingEditor ? "editMode" : ""}`}>

            <div className='editControlsContainer'>
                {!showingEditor && <Button startIcon={<EditIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >Edit</Button>}
                {showingEditor && <Button startIcon={<CloseIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >Close</Button>}
                {props.isSaving ? (<><CircularProgress color="info" size="1rem" /> Saving ...</>) : (
                    isDebouncing ? (<><CircularProgress color="warning" size="1rem" /></>) : (
                        <></>
                    )
                )}
            </div>

            <div className='richTextContentContainer'>
                {showingEditor && <MarkdownEditor value={valueState} onValueChanged={onChange} />}
                <Markdown markdown={valueState} />
            </div>

        </div>
    );
}





////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// must be uncontrolled because of the debouncing. if caller sets the value, then debounce is not possible.
// miraculously works with useQuery() as initial value. i don't understand how tbh.

// similar to the "normal" markdown control
// but
// - single-line
// - no preview
// - tiny edit button next to value
interface CompactMarkdownControlProps {
    initialValue: string | null, // value which may be coming from the database.
    onValueChanged: (val: string | null) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds: number,
}

export function CompactMarkdownControl(props: CompactMarkdownControlProps) {
    const [valueState, setValueState] = React.useState<string | null>(props.initialValue);
    const [firstUpdate, setFirstUpdate] = React.useState<boolean>(true);
    const [isDebouncing, setIsDebouncing] = React.useState<boolean>(false);
    const debouncedMarkdown = useDebounce<string | null>(valueState, props.debounceMilliseconds); // 

    const saveNow = () => {
        setIsDebouncing(false);
        if (firstUpdate && debouncedMarkdown === props.initialValue) {
            setFirstUpdate(false);
            return; // avoid onchange when the control first loads and sets debounced state.
        }
        props.onValueChanged(debouncedMarkdown);
    };

    React.useEffect(saveNow, [debouncedMarkdown]);

    const onChange = (e) => {
        console.log(`onchange`);
        const newval = e.target.value;

        setIsDebouncing(true);
        setValueState(newval);
    };

    const [showingEditor, setShowingEditor] = React.useState<boolean>(false);

    return (
        <div className={`compactMarkdownControl ${showingEditor ? "editMode" : ""}`}>

            <div className='editControlsContainer'>
                {!showingEditor && <Button startIcon={<EditIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >Edit</Button>}
                {showingEditor && <Button startIcon={<CloseIcon />} onClick={() => { saveNow(); setShowingEditor(!showingEditor) }} >Close</Button>}
                {props.isSaving ? (<><CircularProgress color="info" size="1rem" /> Saving ...</>) : (
                    isDebouncing ? (<><CircularProgress color="warning" size="1rem" /></>) : (
                        <></>
                    )
                )}
            </div>

            <div className='richTextContentContainer'>
                {showingEditor && <MarkdownEditor value={valueState} onValueChanged={onChange} />}
                <Markdown markdown={valueState} />
            </div>

        </div>
    );
}

