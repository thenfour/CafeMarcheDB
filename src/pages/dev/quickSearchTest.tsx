import { defineCmdbPage } from "src/route/cmdbPage";
import { makeServerSidePermissionGuard } from "src/auth/server/serverPageAuthorization";
import type { BlitzPage } from "@blitzjs/next";
import React from "react";
import { Permission } from "shared/permissions";
import { ParseQuickFilter, QuickSearchItemTypeSets } from "shared/quickFilter";
import { calculateMatchStrength } from "shared/rootroot";
import { AdminInspectObject, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextField } from "src/core/components/CMTextField";
import { AssociationValueLink } from "src/core/components/ItemAssociation";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { useQuickSearchResults, useQuickSearchScopeKey } from "src/core/components/search/useQuickSearchResults";
import { useLocale } from "src/locale/components/useLocale";

const TestMatchStrength = () => {
    const [sourceText, setSourceText] = React.useState("some text to search in");
    const [userQuery, setUserQuery] = React.useState("");
    return <div>
        <NameValuePair name="Db text to search" value={<CMTextField autoFocus={false} value={sourceText}
            onChange={(_event, value: string) => setSourceText(value)} />} />
        <NameValuePair name="User query" value={<CMTextField autoFocus={false} value={userQuery}
            onChange={(_event, value: string) => setUserQuery(value)} />} />
        <div>Match strength: {calculateMatchStrength(sourceText, userQuery)}</div>
    </div>;
};

const ExplorerSearch = () => {
    const locale = useLocale();
    const [query, setQuery] = React.useState("");
    const { results, status } = useQuickSearchResults({ query, allowedItemTypes: QuickSearchItemTypeSets.Everything,
        permissionPolicy: "omitUnavailable", minimumCharacters: 1, enabled: true });
    return <div className="quickSearchExplorer">
        <NameValuePair name="Quick Search" value={<CMTextField autoFocus value={query}
            onChange={(_event, value: string) => setQuery(value)} />} />
        <AdminInspectObject src={ParseQuickFilter(query)} label="Filter" />
        {status === "error" ? <div role="alert">{locale.getPlainString("search.quick.failed")}</div>
            : results.length === 0 && <div>No results</div>}
        {results.map(item => <div key={`${item.itemType}/${item.id}`} className="test_quickSearchResultItem">
            <AdminInspectObject src={item} label="Filter" />
            <AssociationValueLink value={item} />
            <div className="tinyCaption">match strength: {item.matchStrength} matching on field {item.matchingField || "(?)"}</div>
        </div>)}
    </div>;
};

export const QuickSearchExplorer = () => {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const scopeKey = useQuickSearchScopeKey();
    if (!dashboard.isAuthorized(Permission.sysadmin)) {
        return <div role="alert">{locale.getPlainString("search.quick.denied")}</div>;
    }
    if (!dashboard.authorizationContext?.bandPublicId) {
        return <div>{locale.getPlainString("search.quick.bandRequired")}</div>;
    }
    return <div><TestMatchStrength /><ExplorerSearch key={scopeKey} /></div>;
};

const QuickSearchTestPage: BlitzPage = () => <DashboardLayout title="QuickSearchTestPage"><QuickSearchExplorer /></DashboardLayout>;
defineCmdbPage("devtestQuickSearchTest", QuickSearchTestPage);
export default QuickSearchTestPage;
export const getServerSideProps = makeServerSidePermissionGuard(Permission.sysadmin);
