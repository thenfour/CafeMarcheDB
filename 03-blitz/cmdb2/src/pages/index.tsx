import { BlitzPage, Routes } from "@blitzjs/next";
import { useRouter } from "next/router";
import React, { FC, Suspense } from "react"

const MainContent = () => {
    const router = useRouter();
    return <div>
        <div>public</div>
        <a href="/backstage">go backstage...</a>
    </div>;
};

const PublicIndex: BlitzPage = () => {
    return <Suspense><MainContent /></Suspense>;
}

export default PublicIndex;
