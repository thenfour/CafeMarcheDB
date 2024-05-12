
import { Button, Tab, Tabs } from "@mui/material";
import React from "react";
import { CustomTabPanel, TabA11yProps } from "./CMCoreComponents";
import { Markdown, MarkdownEditor } from "./RichTextEditor";



// over time i find that debounced-save behavior is not useful and when other places on the site use manual save, it's even confusing.
// so here's a full-scale markdown editor with manual save.



// //////////////////////////////////////////////////
// interface Markdown2EditorProps {
//     onSave: (value: string) => Promise<boolean>;
//     onCancel: () => void;
//     onClose: () => void;
//     initialValue: string;
//     displayUploadFileComponent?: boolean;
// };

// export const Markdown2Editor = (props: Markdown2EditorProps) => {
//     const [content, setContent] = React.useState<string>(props.initialValue);
//     const [tab, setTab] = React.useState(0);

//     const handleChangeTab = (event: React.SyntheticEvent, newValue: number) => {
//         setTab(newValue);
//     };

//     const handleSave = async () => {
//         const success = await props.onSave(content);
//         return success;
//     };

//     const handleSaveAndClose = async () => {
//         const success = await handleSave();
//         if (!success) return;
//         props.onClose();
//     };

//     const hasEdits = (content !== props.initialValue);

//     return <>
//         <div className="header">
//             <Button onClick={props.onCancel}>{gIconMap.Cancel()}{hasEdits ? "Cancel" : "Close editor"}</Button>
//             {hasEdits && <Button onClick={async () => { await handleSave() }} >{gIconMap.Save()} Save</Button>}
//             {hasEdits && <Button onClick={async () => { await handleSaveAndClose() }}>{gIconMap.Done()} save & close</Button>}
//         </div>
//         <div className="content">

//             <div className="wikiMarkdownEditorContainer">

//                 <Tabs
//                     value={tab}
//                     onChange={handleChangeTab}
//                     variant="scrollable"
//                     scrollButtons="auto"
//                 >
//                     <Tab label="Edit" {...TabA11yProps("wikiEdit", 0)} />
//                     <Tab label="Preview" {...TabA11yProps("wikiEdit", 1)} />
//                 </Tabs>

//                 <CustomTabPanel tabPanelID='wikiEdit' value={tab} index={0}>
//                     <div className='tabContent editTab'>
//                         <MarkdownEditor
//                             onValueChanged={(v) => setContent(v)}
//                             value={content}
//                             autoFocus={true}
//                             displayUploadFileComponent={props.displayUploadFileComponent}
//                         />
//                     </div>
//                 </CustomTabPanel>

//                 <CustomTabPanel tabPanelID='wikiEdit' value={tab} index={1}>
//                     <div className='tabContent previewTab'>
//                         <Markdown markdown={content} />
//                     </div>
//                 </CustomTabPanel>

//             </div>
//         </div>

//     </>;
// };



// //////////////////////////////////////////////////
// interface Markdown2ViewModeProps {
//     value: string;
//     onEnterEditMode: () => void;
//     isExisting: boolean;
//     readonly: boolean;
// };
// export const Markdown2ViewMode = ({ value, isExisting, readonly, ...props }: Markdown2ViewModeProps) => {
//     return <>
//         <div className="header">
//             <div className="flex-spacer"></div>
//             {isExisting && !readonly && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.Edit()} Edit</Button>}
//             {!isExisting && !readonly && <Button onClick={() => props.onEnterEditMode()}>{gIconMap.AutoAwesome()} Create</Button>}
//         </div>
//         <div className="content">
//             <div className="wikiContentContainer">
//                 <Markdown markdown={value} />
//             </div>
//         </div>
//     </>;
// };



// //////////////////////////////////////////////////
// interface Markdown2ControlProps {
//     value: string;
//     onValueSaved: (v: string) => Promise<boolean>;
//     isExisting: boolean;
//     readonly: boolean;
//     displayUploadFileComponent?: boolean;
// };
// export const Markdown2Control = (props: Markdown2ControlProps) => {
//     const [editing, setEditing] = React.useState<boolean>(false);

//     const handleSave = async (value: string) => {
//         try {
//             const x = await props.onValueSaved(value);
//             return true;
//         } catch (e) {
//             return false;
//         }
//     };

//     return <div className="Markdown2Control">

//         {editing ? <Markdown2Editor
//             initialValue={props.value}
//             onSave={handleSave}
//             onCancel={() => setEditing(false)}
//             onClose={() => setEditing(false)}
//             displayUploadFileComponent={props.displayUploadFileComponent}
//         /> :
//             <Markdown2ViewMode onEnterEditMode={() => setEditing(true)} value={props.value} isExisting={props.isExisting} readonly={props.readonly} />}
//     </div>;
// };
