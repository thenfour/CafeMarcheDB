export {};

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/TopLevelDateSelection.tsx:1-73
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: 126bc99f6a55a89f61ddca3de512040611253032b5bc0e244697cdd155a48091
// MIGRATION_REFERENCE_BEGIN
// import { useQuery } from "@blitzjs/rpc";
// import * as React from 'react';
// import { Bar, CartesianGrid, ComposedChart, Legend, Tooltip, XAxis, YAxis } from "recharts";
// import getGeneralFeatureReport from "@/src/core/components/featureReports/queries/getGeneralFeatureReport";
// import { CMSmallButton } from "../CMCoreComponents2";
// import { FeatureReportFilterSpec } from "./server/facetProcessor";
//
// // date selection, bucket size
// // and other filters
//
// // to allow suspense to work right
// interface FeatureReportTopLevelDateSelectorProps {
//     filterSpec: FeatureReportFilterSpec;
//     //features: ActivityFeature[],
//     //selectedBucket: string | null,
//     //excludeYourself: boolean;
//     //excludeSysadmins: boolean;
//     //aggregateBy: ActivityReportTimeBucketSize,
//     startDate: Date,
//     endDate: Date,
//     onClickBucket: (bucket: string) => void,
//     refetchTrigger: number,
//     //contextBeginsWith: string | undefined,
//     setDataUpdatedAt: (date: Date) => void,
// };
//
// export const FeatureReportTopLevelDateSelector = ({ filterSpec, setDataUpdatedAt, refetchTrigger, onClickBucket, startDate, endDate }: FeatureReportTopLevelDateSelectorProps) => {
//     const [result, { refetch, dataUpdatedAt }] = useQuery(getGeneralFeatureReport, {
//         filterSpec,
//         startDate,//: roundToNearest15Minutes(startDate),
//         endDate,//: roundToNearest15Minutes(endDate),
//     });
//
//     React.useEffect(() => {
//         refetchTrigger && refetch();
//     }, [refetchTrigger]);
//
//     React.useEffect(() => {
//         if (dataUpdatedAt) {
//             setDataUpdatedAt(new Date(dataUpdatedAt));
//         }
//     }, [dataUpdatedAt]);
//
//     const chartData = result.data.map((item) => ({
//         ...item,
//         //fill: selectedBucket === item.bucket ? "#c6c" : "#66c",
//         fill: filterSpec.selectedBucket === item.bucket ? "#cc8" : "#484",
//     }));
//
//     const handleBucketClick = (data: { bucket: string, count: number }, index: number, e) => {
//         onClickBucket(data.bucket);
//     };
//
//     return <div>
//         <CMSmallButton>{result.metrics.queryTimeMs} ms</CMSmallButton>
//         <ComposedChart
//             width={800}
//             height={600}
//             data={chartData}
//         >
//             <CartesianGrid stroke="#f5f5f5" />
//             <XAxis dataKey="bucket" />
//             <YAxis />
//             <Tooltip />
//             <Legend />
//
//             {/* <Bar dataKey="count" barSize={30} fill="#44f" onClick={handleBucketClick} isAnimationActive={true} animationDuration={40} /> */}
//             <Bar dataKey="count" barSize={30} onClick={handleBucketClick} isAnimationActive={true} animationDuration={40} />
//
//         </ComposedChart>
//     </div>
//
// };
// MIGRATION_REFERENCE_END
