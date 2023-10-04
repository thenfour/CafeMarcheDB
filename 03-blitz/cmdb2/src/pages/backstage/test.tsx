import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Suspense } from "react";
import getAllRoles from "src/auth/queries/getAllRoles";
import getTestQuery from "src/auth/queries/getTestQuery";
import * as React from 'react';

let gSeed = 100;
const getNextSeed = () => {
    console.log(`seed: ${gSeed}`);
    return ++gSeed;
}

const buttonStyle: React.CSSProperties = {
    backgroundColor: "#eee",
    border: "1px solid #444",
    cursor: "pointer",
    width: "min-content",
    whiteSpace: "nowrap",
    margin: 7,
    padding: 7,
};
const componentStyle: React.CSSProperties = {
    backgroundColor: "#cff",
    margin: 15,
    padding: 15,
    borderRadius: 7,
    border: "4px solid #f80",
};
const componentStyle2: React.CSSProperties = {
    backgroundColor: "#ccc",
    margin: 15,
    padding: 15,
    borderRadius: 7,
};

interface QueryParams {
    delayMilliseconds: number;
    seed: number;
};

const Controls = ({ queryParams, setQueryParams }) => {
    return <>
        <div>seed: {queryParams.seed} <div style={buttonStyle} onClick={() => setQueryParams({ ...queryParams, seed: getNextSeed() })}>New seed</div></div >
        <div style={{ display: "flex" }}>
            <div style={buttonStyle} onClick={() => setQueryParams({ ...queryParams, delayMilliseconds: 10 })}>10</div>
            <div style={buttonStyle} onClick={() => setQueryParams({ ...queryParams, delayMilliseconds: 50 })}>50</div>
            <div style={buttonStyle} onClick={() => setQueryParams({ ...queryParams, delayMilliseconds: 100 })}>100</div>
            <div style={buttonStyle} onClick={() => setQueryParams({ ...queryParams, delayMilliseconds: 300 })}>300</div>
            <div style={buttonStyle} onClick={() => setQueryParams({ ...queryParams, delayMilliseconds: 1000 })}>1000</div>
            <div style={buttonStyle} onClick={() => setQueryParams({ ...queryParams, delayMilliseconds: 6000 })}>6000</div>
        </div>
    </>;
};

const InnerContent = ({ queryParams }: { queryParams: QueryParams }) => {
    const x = useQuery(getTestQuery, queryParams);
    return <div style={componentStyle}>
        <div>Query status: {x[1].status}</div>
        <div>Query result: {`${x[0]}`}</div>
    </div>;
};

const InnerContentWithChild = ({ queryParams }: { queryParams: QueryParams }) => {
    const [queryParams1, setQueryParams1] = React.useState<QueryParams>({
        delayMilliseconds: 200,
        seed: 12,
    });
    const x = useQuery(getTestQuery, queryParams);
    return <div style={componentStyle}>
        <div>Query status: {x[1].status}</div>
        <div>Query result: {`${x[0]}`}</div>

        <div style={componentStyle2}>
            <div>this will use a nested suspense.</div>
            <Controls queryParams={queryParams1} setQueryParams={setQueryParams1} />
            <Suspense fallback={"nested inner suspense"}>
                <InnerContent queryParams={queryParams1} />
            </Suspense>
        </div>

    </div>;
};

const TestPageContent = () => {
    const [queryParams1, setQueryParams1] = React.useState<QueryParams>({
        delayMilliseconds: 200,
        seed: 10,
    });
    const [queryParams2, setQueryParams2] = React.useState<QueryParams>({
        delayMilliseconds: 200,
        seed: 11,
    });

    return <div style={componentStyle}>
        <div style={componentStyle2}>
            <div>this will use the OUTER suspense.</div>
            <Controls queryParams={queryParams1} setQueryParams={setQueryParams1} />
            <InnerContentWithChild queryParams={queryParams1} />
        </div>
        <div style={componentStyle2}>
            <div>this will use the INNER suspense; outer suspense should not trigger.</div>
            <Controls queryParams={queryParams2} setQueryParams={setQueryParams2} />
            <Suspense fallback={"inner suspense"}>
                <InnerContentWithChild queryParams={queryParams2} />
            </Suspense>
        </div>
    </div>;
}

const TestPage: BlitzPage = () => {
    return <Suspense fallback={"outer suspense"}><TestPageContent /></Suspense>;
}

export default TestPage;
