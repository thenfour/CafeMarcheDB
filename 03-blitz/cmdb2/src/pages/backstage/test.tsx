

import { BlitzPage } from "@blitzjs/next";
import * as React from 'react';
import { Suspense } from "react";
import { DateTimeRangeControlExample } from "src/core/components/DateTimeRangeControl";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const MyComponent = () => {
    return (
        <div>
            <DateTimeRangeControlExample />

        </div>
    );
};

const TestPage: BlitzPage = () => {
    return <Suspense><MyComponent /></Suspense>;
}

export default TestPage;
