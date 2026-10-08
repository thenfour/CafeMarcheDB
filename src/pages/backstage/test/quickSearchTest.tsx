import { makeServerSidePermissionGuard } from "src/auth/server/serverPageAuthorization";
import { DeferredQuickSearchPage } from "src/core/components/DeferredFeaturePage";
import { Permission } from "shared/permissions";

export default DeferredQuickSearchPage;
export const getServerSideProps = makeServerSidePermissionGuard(Permission.sysadmin);

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/pages/backstage/test/quickSearchTest.tsx:1-91
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 8f9f39b15daabbfbb51f32c9bdae0a0acb78427cba7ae152ee840f9fc07b3d2b
// MIGRATION_REFERENCE_BEGIN
// import { makeServerSidePermissionGuard } from "@/src/auth/server/serverPageAuthorization";
// import { AssociationValueLink, fetchObjectQuery } from "@/src/core/components/ItemAssociation";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { BlitzPage } from "@blitzjs/next";
// import React from "react";
// import { Permission } from "shared/permissions";
// import { ParseQuickFilter, QuickSearchItemMatch, QuickSearchItemTypeSets } from "shared/quickFilter";
// import { calculateMatchStrength } from "shared/rootroot";
// import { AdminInspectObject, NameValuePair } from "src/core/components/CMCoreComponents2";
// import { CMTextField } from "src/core/components/CMTextField";
//
// const TestMatchStrength = () => {
//     const [sourceText, setSourceText] = React.useState<string>("some text to search in");
//     const [userQuery, setUserQuery] = React.useState<string>("");
//
//     const matchStrength = calculateMatchStrength(sourceText, userQuery);
//
//     return <div>
//         <NameValuePair name="Db text to search" value={
//             <CMTextField
//                 autoFocus={false} // see #408// see #408 auto-focusing on mobile is undesirable; short-term fix is to disable.
//                 value={sourceText}
//                 onChange={(e) => setSourceText(e.target.value)}
//             />
//         } />
//         <NameValuePair name="User query" value={
//             <CMTextField
//                 autoFocus={false} // see #408 auto-focusing on mobile is undesirable; short-term fix is to disable.
//                 value={userQuery}
//                 onChange={(e) => setUserQuery(e.target.value)}
//             />
//         } />
//         <div>
//             Match strength: {matchStrength}
//         </div>
//     </div>;
// };
//
// const MainContent = () => {
//     const [queryText, setQueryText] = React.useState<string>("");
//     const [results, setResults] = React.useState<QuickSearchItemMatch[]>([]);
//
//     React.useEffect(() => {
//         fetchObjectQuery(queryText, QuickSearchItemTypeSets.Everything!).then((res) => {
//             setResults(res);
//         }).catch((err) => {
//             console.error("Error fetching results:", err);
//         });
//     }, [queryText]);
//
//     return <div>
//         <TestMatchStrength></TestMatchStrength>
//         <NameValuePair name="Quick Search" value={
//             <CMTextField
//                 autoFocus={true}
//                 value={queryText}
//                 onChange={(e) => setQueryText(e.target.value)}
//             />
//         } />
//         <AdminInspectObject src={ParseQuickFilter(queryText)} label="Filter" />
//         <div>
//             {results.length === 0 ? <div>No results</div> : null}
//             {results.map((item, index) => {
//                 return <div key={index} className="test_quickSearchResultItem">
//                     <div>
//                         <AdminInspectObject src={item} label="Filter" />
//                     </div>
//                     <div>
//                         <AssociationValueLink value={item} />
//                     </div>
//                     <div className="tinyCaption">
//                         match strength: {item.matchStrength} matching on field {item.matchingField || "(?)"}
//                     </div>
//                 </div>;
//             })}
//         </div>
//     </div>;
// };
//
//
// const QuickSearchTestPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="QuickSearchTestPage">
//             <MainContent />
//         </DashboardLayout>
//     )
// }
//
// export default QuickSearchTestPage;
//
// export const getServerSideProps = makeServerSidePermissionGuard(Permission.sysadmin);
// MIGRATION_REFERENCE_END
