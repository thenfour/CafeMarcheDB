'use client'

// import { BlitzPage } from "@blitzjs/next";
// import DashboardLayout from "src/core/layouts/DashboardLayout";
// import { Permission } from "shared/permissions";
// import { useAuthorization } from "src/auth/hooks/useAuthorization";

// const EditSongsPage: BlitzPage = () => {
//     // if (!useAuthorization("edit songs page", Permission.view_songs)) {
//     //     throw new Error(`unauthorized`);
//     // }
//     return (
//         <DashboardLayout title="Edit Songs">
//             // edit songs
//         </DashboardLayout>
//     )
// }

// export default EditSongsPage;

// import 'react-quill/dist/quill.snow.css'


import React, { Suspense } from "react";
// import dynamic from "next/dynamic";

// const ReactQuill = dynamic(() => import("react-quill"), { ssr: false, suspense: true });




export default function EditSongsPage() {
    const [value, setValue] = React.useState('aoesunth');
    return (
        <div style={{ width: "500px", height: "500px" }}>
            <p>Next.js Example</p>

            <Suspense fallback="Loading...">
                {/* <ReactQuill value={value} onChange={setValue} /> */}
            </Suspense>
        </div>
    );
}