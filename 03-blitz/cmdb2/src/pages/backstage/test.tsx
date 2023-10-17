import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Suspense } from "react";
import getAllRoles from "src/auth/queries/getAllRoles";
import getTestQuery from "src/auth/queries/getTestQuery";
import * as React from 'react';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { InspectObject } from "src/core/components/CMCoreComponents";

// so we need to support:
// DATES + TIMES + nulls for both start + end.
interface DateTimeRangeSpec {
    startsAt: Date | null;
    endsAt: Date | null;
};

interface DateTimeRangeControlProps {
    value: DateTimeRangeSpec;
    onChange: (newValue: DateTimeRangeSpec) => void;
};

const DateTimeRangeControl = (props: DateTimeRangeControlProps) => {

    return <div className="DateTimeRangeControl">

    </div>;
};

const TestPageContent = () => {
    return <>
        <DateTimeRangeControl />
    </>;
}

const TestPage: BlitzPage = () => {
    return <Suspense fallback={"outer suspense"}><TestPageContent /></Suspense>;
}

export default TestPage;
