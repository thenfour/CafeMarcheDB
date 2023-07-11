//import dynamic from "next/dynamic";
import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import React from 'react';
//import ReactDOM from 'react-dom';
//import { Editor, EditorState } from 'draft-js';
//import 'draft-js/dist/Draft.css';
//import { Editor } from "react-draft-wysiwyg";
//import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";
//import { EditorState } from 'draft-js';



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





const InfoPage: BlitzPage = () => {
    if (!useAuthorization("info page", Permission.view_general_info)) {
        throw new Error(`unauthorized`);
    }

    // const Editor = dynamic(() => import("react-draft-wysiwyg"), {
    //     ssr: false,
    // });

    // const [editorState, setEditorState] = React.useState(EditorState.createEmpty());

    // const onEditorStateChange = (newState) => {
    //     setEditorState(newState);
    // };

    return (
        <DashboardLayout title="Info">
        </DashboardLayout>
    )
}

export default InfoPage;
