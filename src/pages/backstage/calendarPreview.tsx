import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Button, FormControlLabel, Switch } from "@mui/material";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { DateTimeRange } from "shared/time";
import { IsNullOrWhitespace } from "shared/utils";
import { CMTable, EventDateField, KeyValueDisplay } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { gIconMap } from "src/core/db3/components/IconMap";
import getCalendarPreview from "src/core/db3/queries/getCalendarPreview";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const CopyText = ({ value, label }: { value: string, label?: string | undefined }) => {

    const snackbar = useSnackbar();

    const clipboardCopy = async () => {
        console.log(value);
        await navigator.clipboard.writeText(value);
        snackbar.showMessage({ severity: "success", children: `Copied ${value.length} characters to clipboard` });
    };

    return <div className='debugInspectorOpen' onClick={clipboardCopy}>{gIconMap.ContentCopy()} {label}</div>

}

const MainContent = () => {
    const [tab, setTab] = React.useState<number>(0);
    const [showDetails, setShowDetails] = React.useState<boolean>(false);
    const [filterText, setFilterText] = React.useState<string>("");
    //console.log(cal);
    const [cal, queryExtra] = useQuery(getCalendarPreview, {});
    const { events, ...rootValues } = cal;
    const filterTextLower = filterText.toLowerCase();
    const filteredCal = {
        ...rootValues, events: events.filter(e => {
            if (IsNullOrWhitespace(filterText)) return true;
            const json = JSON.stringify(e);
            return (json.toLowerCase().indexOf(filterTextLower)) !== -1;
        })
    };

    const { iCalText, ...moreValues } = {
        ...rootValues,
        totalEvents: events.length,
        shownEvents: filteredCal.events.length,
        hiddenEvents: events.length - filteredCal.events.length,
    }

    const eventsWithId = filteredCal.events.map((e, i) => ({ i, ...e }));
    return <div>
        <FormControlLabel
            control={
                <Switch checked={showDetails} onChange={e => {
                    setShowDetails(e.target.checked);
                }} />
            }
            label="Show details"
        />
        <FormControlLabel
            control={
                <CMTextInputBase value={filterText} onChange={(e, v) => setFilterText(v)} />}
            label="Filter"
        />
        <Button onClick={() => queryExtra.refetch()}>Refresh</Button>
        <KeyValueDisplay data={moreValues} />
        <CMTabPanel handleTabChange={(e, n) => setTab(n as any)} selectedTabId={tab} >
            <CMTab thisTabId={0} summaryTitle={"Table"}>
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
                        { memberName: "uid" },
                        {
                            memberName: "url", render: args => {
                                return <a href={args.row.url} target="_blank" rel="noreferrer">{args.row.url}</a>
                            }
                        },
                    ]}
                />
            </CMTab>
            <CMTab thisTabId={1} summaryTitle={"Text"}>
                <CopyText value={iCalText} label={`Copy ${iCalText.length.toLocaleString()} chars`} />
                <pre>{iCalText}</pre>
            </CMTab>
        </CMTabPanel>
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
