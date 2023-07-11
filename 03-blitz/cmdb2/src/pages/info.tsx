'use client'
import dynamic from "next/dynamic";
//import { BlitzPage, dynamic } from "blitz"
import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import React from 'react';
import { lazy, Suspense } from 'react';
import RichTextEditor from "src/core/components/RichTextEditor";

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





const Info9Page: BlitzPage = () => {


    return (
        <DashboardLayout title="Info">
            <RichTextEditor></RichTextEditor>
        </DashboardLayout>
    )
}

export default Info9Page;
