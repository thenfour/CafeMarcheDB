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

const TestPageContent = () => {

    const testQueryRet = useQuery(getTestQuery, {});

    console.log(testQueryRet[0]);

    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = {
        intention: 'user',
        mode: 'primary',
        currentUser: currentUser,
    };

    // const queryArgs: DB3Client.xTableClientArgs = {
    //     requestedCaps: DB3Client.xTableClientCaps.Query,
    //     clientIntention,
    //     tableSpec: new DB3Client.xTableClientSpec({
    //         table: db3.xTestEvent,
    //         columns: [
    //             new DB3Client.PKColumnClient({ columnName: "id" }),
    //         ],
    //     }),
    //     filterModel: {
    //         items: [],
    //         tableParams: {},
    //     }
    // };

    // const where = db3.xTestEvent.CalculateWhereClause({
    //     clientIntention,
    //     filterModel: {
    //         items: [],
    //     },
    // });

    console.log(`[[[ calling calculateInclude`);
    const include = db3.xTestEvent.CalculateInclude(clientIntention);
    console.log(`]]] calling calculateInclude`);

    return <>
        {/* <InspectObject src={where} tooltip="where" /> */}
        <InspectObject src={include} tooltip="include" />
    </>;
}

const TestPage: BlitzPage = () => {
    return <Suspense fallback={"outer suspense"}><TestPageContent /></Suspense>;
}

export default TestPage;
