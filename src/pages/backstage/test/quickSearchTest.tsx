import { BlitzPage } from "@blitzjs/next";
import React from "react";
import { Permission } from "shared/permissions";
import { ParseQuickFilter, QuickSearchItemMatch } from "shared/quickFilter";
import { calculateMatchStrength } from "shared/rootroot";
import { AdminInspectObject } from "src/core/components/CMCoreComponents";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextField } from "src/core/components/CMTextField";
import { AssociationValueLink, fetchObjectQuery } from "src/core/components/setlistPlan/ItemAssociation";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const TestMatchStrength = () => {
    const [sourceText, setSourceText] = React.useState<string>("some text to search in");
    const [userQuery, setUserQuery] = React.useState<string>("");

    const matchStrength = calculateMatchStrength(sourceText, userQuery);

    return <div>
        <NameValuePair name="Db text to search" value={
            <CMTextField
                autoFocus={false} // see #408
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
            />
        } />
        <NameValuePair name="User query" value={
            <CMTextField
                autoFocus={false} // see #408
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
            />
        } />
        <div>
            Match strength: {matchStrength}
        </div>
    </div>;
};

const MainContent = () => {
    const [queryText, setQueryText] = React.useState<string>("");
    const [results, setResults] = React.useState<QuickSearchItemMatch[]>([]);

    React.useEffect(() => {
        fetchObjectQuery(queryText).then((res) => {
            setResults(res);
        }).catch((err) => {
            console.error("Error fetching results:", err);
        });
    }, [queryText]);

    return <div>
        <TestMatchStrength></TestMatchStrength>
        <NameValuePair name="Quick Search" value={
            <CMTextField
                autoFocus={true}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
            />
        } />
        <AdminInspectObject src={ParseQuickFilter(queryText)} label="Filter" />
        <div>
            {results.length === 0 ? <div>No results</div> : null}
            {results.map((item, index) => {
                return <div key={index} className="test_quickSearchResultItem">
                    <div>
                        <AdminInspectObject src={item} label="Filter" />
                    </div>
                    <div>
                        <AssociationValueLink value={item} />
                    </div>
                    <div className="tinyCaption">
                        match strength: {item.matchStrength} matching on field {item.matchingField || "(?)"}
                    </div>
                </div>;
            })}
        </div>
    </div>;
};


const QuickSearchTestPage: BlitzPage = () => {
    return (
        <DashboardLayout title="QuickSearchTestPage" basePermission={Permission.public}>
            <MainContent />
        </DashboardLayout>
    )
}

export default QuickSearchTestPage;
