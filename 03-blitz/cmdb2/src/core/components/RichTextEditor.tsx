//'use client'

// ok we're close. now there's a sequence of events creating a flicker
// debounce starts, we use an internal value.
// debounce stops, now we use the passed in value (which is not correct)
// so there needs to be many intermediate steps, between both the text editor and the caller.
// better to just make it uncontrolled, so what the user sees is ALWAYS correct.

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

interface RichTextEditorProps {
    initialValue: string, // value which may be coming from the database.
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds: number,
}

// we will control the value, but callers must treat as uncontrolled.
interface RichTextEditorValueState {
    markdown: string | null, // null indicates the value has'nt been set at all. don't call callbacks for example.
    html: string,
}

function MarkdownToHTML(md: any, value: string): string {
    return md.render(value);
}


export default function RichTextEditor(props: RichTextEditorProps) {
    const [md, setMd] = React.useState<any>(null);
    const [valueState, setValueState] = React.useState<RichTextEditorValueState>({
        markdown: null,
        html: "",
    });

    const [isDebouncing, setIsDebouncing] = React.useState<boolean>(false);
    const debouncedMarkdown = useDebounce<string | null>(valueState.markdown, props.debounceMilliseconds); // 

    React.useEffect(() => {
        const md2 = new MarkdownIt;
        //console.log(`init richtexteditor with initial value ${props.initialValue}`);
        setMd(md2);
        setValueState({
            markdown: props.initialValue,
            html: md2.render(props.initialValue),
        });
    }, []);

    // when debounced value changes, tell caller to commit.
    React.useEffect(() => {
        //console.log(`debouncedMarkdown changed to ${debouncedMarkdown}`);
        setIsDebouncing(false);
        if (debouncedMarkdown !== null) {
            //console.log(`calling onValueChanged with ${debouncedMarkdown}; ${typeof md}`);
            if (props.onValueChanged) props.onValueChanged(debouncedMarkdown);
        }
    }, [debouncedMarkdown]);

    // raw onchange; set internal state for temp use while debouncing
    const onChange = (e) => {
        const newval = e.target.value;
        setIsDebouncing(true);
        console.assert(!!md);
        setValueState({
            markdown: newval,
            html: md.render(newval),
        });
    };

    const [showingEditor, setShowingEditor] = React.useState<boolean>(false);

    return (
        <div className={`richTextContainer ${showingEditor ? "editMode" : ""}`}>

            <div className='editControlsContainer'>
                {!showingEditor && <Button startIcon={<EditIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >Edit</Button>}
                {showingEditor && <Button startIcon={<CloseIcon />} onClick={() => { setShowingEditor(!showingEditor) }} >Close</Button>}
                {/* <Button startIcon={<DeleteIcon />}>Delete</Button> */}
                {props.isSaving ? (<><CircularProgress color="info" size="1rem" /> Saving ...</>) : (
                    isDebouncing ? (<><CircularProgress color="warning" size="1rem" /></>) : (
                        <></>
                    )
                )}
            </div>

            <div className='richTextContentContainer'>

                {showingEditor && (<>
                    <div className='editorContainer'>
                        <TextField className='input' multiline={true} value={valueState.markdown} onChange={onChange}></TextField>
                    </div>
                </>
                )}
                <div className='renderedContent'>
                    <div dangerouslySetInnerHTML={{ __html: valueState.html }}></div>


                </div >
            </div>

        </div>
    );
}

