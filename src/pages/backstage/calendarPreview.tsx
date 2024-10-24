import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import * as React from 'react';
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, IsNullOrWhitespace, existsInArray, toggleValueInArray } from "shared/utils";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { CMTable, EventDateField, KeyValueDisplay, KeyValueTable, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import getDistinctChangeFilterValues from "src/core/db3/queries/getDistinctChangeFilterValues";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Prisma } from "db";
import { WorkflowViewer } from "src/core/components/WorkflowEventComponents";
import getCalendarPreview from "src/core/db3/queries/getCalendarPreview";
import { Markdown } from "src/core/components/RichTextEditor";
import { FormControlLabel, Switch } from "@mui/material";
import { CalcRelativeTiming, DateTimeRange } from "shared/time";
import { DateRangeViewer } from "src/core/components/DateTimeRangeControl";


const MainContent = () => {
    const [cal, _] = useQuery(getCalendarPreview, {});
    const [showDetails, setShowDetails] = React.useState<boolean>(false);
    console.log(cal);
    const { events, ...rootValues } = cal;
    const eventsWithId = events.map((e, i) => ({ i, ...e }));
    return <div>
        <FormControlLabel
            control={
                <Switch checked={showDetails} onChange={e => {
                    setShowDetails(e.target.checked);
                }} />
            }
            label="Show details"
        />
        <KeyValueDisplay data={rootValues} />
        <CMTable
            className="CalendarPreview TopAlignedCells"
            rows={eventsWithId}
            columns={[
                { memberName: "i" },
                { memberName: "summary" },
                {
                    header: "Date", render: args => {
                        if (!args.row.end) {
                            return args.row.start.toDateString() + args.row.allDay ? "(all day)" : "";
                        }
                        if (!args.row.start) {
                            return "no start date?";
                        }
                        const r = new DateTimeRange({ startsAtDateTime: args.row.start, isAllDay: args.row.allDay, durationMillis: args.row.end.valueOf() - args.row.start.valueOf() });
                        return <EventDateField dateRange={r} />;
                    }
                },
                {
                    memberName: "description", render: (args) => {
                        if (!showDetails) return <span className="faded">hidden</span>;
                        const val = args.row.description;
                        if (!val) return <span className="faded">none</span>;
                        return <Markdown markdown={val.html || val.plain || ""} />
                    }
                },
                { memberName: "location" },
                { memberName: "organizer" },
                { memberName: "sequence" },
                { memberName: "status" },
                {
                    memberName: "url", render: args => {
                        return <a href={args.row.url} target="_blank" rel="noreferrer">{args.row.url}</a>
                    }
                },
            ]}
        />
    </div>;
};


const CalendarPreviewPage: BlitzPage = () => {
    return (
        <DashboardLayout title="iCal Preview" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    )
}

export default CalendarPreviewPage;
