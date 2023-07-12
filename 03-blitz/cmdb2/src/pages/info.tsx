'use client'
//import { BlitzPage, dynamic } from "blitz"
import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import getSetting from "src/auth/queries/getSetting";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import RichTextEditor from "src/core/components/RichTextEditor";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { Suspense } from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";

import NoSSR from 'react-no-ssr';
//import RichTextEditorDraft from "src/core/components/RichTextEditorDraft";

//import ReactDOM from 'react-dom';
//import { Editor, EditorState } from 'draft-js';
//import 'draft-js/dist/Draft.css';
//import { Editor } from "react-draft-wysiwyg";
//import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";
//import { EditorState } from 'draft-js';
//import 'react-quill/dist/quill.snow.css'
//import SunEditor from 'suneditor-react';
//import 'suneditor/dist/css/suneditor.min.css'; // Import Sun Editor's CSS File

//import StarterKit from '@tiptap/starter-kit'

//import { useEditor, EditorContent } from '@tiptap/react'

// const Tiptap = () => {
//     const editor = useEditor({
//         extensions: [
//             //StarterKit,
//         ],
//         content: '<p>Hello World! 🌎️</p>',
//     })

//     return (
//         <EditorContent editor={editor} />
//     )
// }




// import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

// const TextEditor = () => {
//     const Editor = dynamic(
//         () => import('react-draft-wysiwyg').then((mod) => mod.Editor),
//         { ssr: false }
//     )
//     return (
//         <>
//             <div className="container my-5">
//                 <Editor
//                 />
//             </div>
//         </>
//     )
// }


// const QuillNoSSRWrapper = dynamic(import('react-quill'), {
//     ssr: false,
//     loading: () => <p>Loading ...</p>,
// })


// const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
//const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

interface MyProps {

};

//props: React.PropsWithChildren<MyProps>
const MyContent = (props: React.PropsWithChildren<MyProps>) => {
    // we want to use the db value, but also want to show the user's typed value while the db saves.
    let [value, { refetch }] = useQuery(getSetting, "info_text");
    const [optimisticValue, setOptimisticValue] = React.useState<string>(value || "");
    const [updateSetting] = useMutation(updateSettingMutation);
    const [saved, setSaved] = React.useState(true);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onValueChanged = (newValue: string) => {
        console.log(`-> caller onValueChanged('${newValue}'). setting saved=false and switching to optimistic`);
        setOptimisticValue(newValue); // while we wait for the save to take place, keep the value optimistically.
        setSaved(false);
        updateSetting({ name: "info_text", value: newValue }).then(x => {
            showSnackbar({ severity: "success", children: `should be saved...` });
            setSaved(true);
            console.log(`-> mutation complete; setting saved=true and switching to db value`);
            refetch();
        }).catch(e => {
            showSnackbar({ severity: "error", children: `error when updating setting` });
        });
    };

    //const publicValue = saved ? value : optimisticValue;
    const publicValue = optimisticValue;

    console.log(`caller rendering. publicValue:${publicValue}, dbvalue:${value}, saved:${saved}`);

    return <RichTextEditor value={publicValue || ""} saved={saved} onValueChanged={onValueChanged} debounceMilliseconds={500}></RichTextEditor>;
};



const Info9Page: BlitzPage = () => {

    // return (
    //     <NoSSR fallback="Loading...">
    //         <MyContent>info</MyContent>
    //     </NoSSR>
    // );

    return (
        <DashboardLayout title="Info">
            <Suspense fallback="Loading...">
                <MyContent />
            </Suspense>
        </DashboardLayout>
    );



    // return (
    //     // <NoSSR fallback="Loading...">
    //     //<DashboardLayout title="Info">
    //     {/* <Suspense fallback="Loading..."> */ }
    // {/* <RichTextEditor value={value} saved={saved} onValueChanged={null}></RichTextEditor> */ }
    // {/* </Suspense> */ }
    //     //</DashboardLayout>
    //     // </NoSSR>
    // )
}

export default Info9Page;
