import { invoke } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import React from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "src/locale/components/useLocale";
import getGeneralFeatureReport from "./queries/getGeneralFeatureReport";
import type { GeneralFeatureReportBucket, GeneralFeatureReportInput, GeneralFeatureReportResult } from "./activityReportTypes";

interface FeatureReportTopLevelDateSelectorProps {
    readonly input: GeneralFeatureReportInput;
    readonly selectedBucket: string | null;
    readonly onClickBucket: (bucket: string) => void;
    readonly refetchTrigger: number;
    readonly setDataUpdatedAt: (date: Date) => void;
}

export function FeatureReportTopLevelDateSelector(props: FeatureReportTopLevelDateSelectorProps) {
    const { input, refetchTrigger, setDataUpdatedAt } = props;
    const locale = useLocale();
    const [loaded, setLoaded] = React.useState<{ key: string; result: GeneralFeatureReportResult } | null>(null);
    const [failedKey, setFailedKey] = React.useState<string | null>(null);
    const requestKey = JSON.stringify([input, refetchTrigger]);
    React.useEffect(() => {
        let current = true;
        setFailedKey(null);
        setLoaded(null);
        void invoke(getGeneralFeatureReport, input).then(result => {
            if (current) {
                setLoaded({ key: requestKey, result });
                setDataUpdatedAt(new Date());
            }
        }).catch(() => {
            if (current) {
                setFailedKey(requestKey);
            }
        });
        return () => { current = false; };
    }, [input, refetchTrigger, setDataUpdatedAt, requestKey]);
    if (failedKey === requestKey) {
        return <Alert severity="error">{locale.getPlainString("activityReports.failed")}</Alert>;
    }
    const result = loaded?.key === requestKey ? loaded.result : null;
    if (!result) {
        return <div role="status">{locale.getPlainString("activityReports.loading")}</div>;
    }
    const chartData = result.data.map(item => ({ ...item, fill: props.selectedBucket === item.bucket ? "#cc8" : "#484" }));
    const countLabel = locale.getPlainString("activityReports.count");
    const total = result.data.reduce((sum, bucket) => sum + bucket.count, 0);
    return <div data-activity-timeline data-activity-total={total}>
        <div>{countLabel}: {total.toLocaleString(locale.formattingLocale ?? undefined)}</div>
        <div className="smallText">{result.metrics.queryTimeMs} ms</div>
        <ResponsiveContainer width="100%" height={420}>
            <ComposedChart data={chartData}>
                <CartesianGrid stroke="#f5f5f5" />
                <XAxis dataKey="bucket" /><YAxis allowDecimals={false} />
                <Tooltip /><Legend />
                <Bar dataKey="count" name={countLabel} barSize={30} onClick={(bucket: GeneralFeatureReportBucket) => props.onClickBucket(bucket.bucket)}
                    isAnimationActive animationDuration={40} />
            </ComposedChart>
        </ResponsiveContainer>
    </div>;
}
