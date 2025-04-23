import { parseBucketToDateRange } from '@/shared/mysqlUtils';
import { formatMillisecondsToDHMS } from '@/shared/time';
import { useQuery } from '@blitzjs/rpc';
import * as React from 'react';
import { gIconMap } from '../db3/components/IconMap';
import getGeneralFeatureDetail from '../db3/queries/getGeneralFeatureDetail';
import { ActivityDetailTabId } from "../db3/shared/activityTabs";
import { ActivityFeature } from "../db3/shared/activityTracking";
import { GeneralActivityReportDetailPayload, ReportAggregateBy } from "../db3/shared/apiTypes";
import { CMChip } from './CMChip';
import { AttendanceChip, EventChip, FileChip, InstrumentChip, SongChip, WikiPageChip } from './CMCoreComponents';
import { useDashboardContext } from "./DashboardContext";
import { AnonymizedUserChip, ContextLabel, ContextObjectTabData, DistinctContextObjectTabContent, FeatureLabel, GeneralFeatureDetailTable, getContextObjectTabData } from './FeatureReportBasics';
import { CMTab, CMTabPanel, CMTabPanelChild } from './TabPanel';

interface GeneralFeatureDetailAreaProps {
    features: ActivityFeature[];
    excludeFeatures: ActivityFeature[];
    bucket: string | null;
    aggregateBy: ReportAggregateBy;
    excludeYourself: boolean;
    excludeSysadmins: boolean;
    contextBeginsWith: string | undefined;
    refetchTrigger: number;
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
    onFilterContext: (context: string) => void;
};

export const GeneralFeatureDetailArea = ({ excludeYourself, features, contextBeginsWith, excludeFeatures, excludeSysadmins, bucket, aggregateBy, refetchTrigger, onIsolateFeature, onExcludeFeature, onFilterContext }: GeneralFeatureDetailAreaProps) => {
    const dashboardContext = useDashboardContext();
    const [tabId, setTabId] = React.useState<ActivityDetailTabId>(ActivityDetailTabId.general);

    const [detail, { refetch }] = useQuery(getGeneralFeatureDetail, {
        features,
        excludeFeatures,
        bucket,
        aggregateBy,
        excludeYourself,
        excludeSysadmins,
        contextBeginsWith,
    });

    React.useEffect(() => {
        refetchTrigger && refetch();
    }, [refetchTrigger]);


    const tabs: ContextObjectTabData[] = React.useMemo(() => {
        interface TabConfig {
            id: ActivityDetailTabId;
            label: string;
            filterFn: (item: GeneralActivityReportDetailPayload) => boolean;
            keyFn: (item: GeneralActivityReportDetailPayload) => string;
            renderFn: (item: GeneralActivityReportDetailPayload) => React.ReactNode;
            getlabel: (item: GeneralActivityReportDetailPayload) => string;
        }

        const tabConfigs: TabConfig[] = [
            {
                id: ActivityDetailTabId.feature,
                label: "Features",
                filterFn: (item) => !!item.feature,
                keyFn: (item) => item.feature,
                renderFn: (item) => <FeatureLabel feature={item.feature as ActivityFeature} onClickExclude={() => { }} onClickIsolate={() => { }} />,
                getlabel: (item) => item.feature,
            },
            {
                id: ActivityDetailTabId.user,
                label: "Users",
                filterFn: (item) => !!item.userHash,
                keyFn: (item) => item.userHash!,
                renderFn: (item) => <AnonymizedUserChip value={item.userHash!} size={50} />,
                getlabel: (item) => item.userHash!.substring(0, 6),
            },
            {
                id: ActivityDetailTabId.song,
                label: "Songs",
                filterFn: (item) => !!item.song,
                keyFn: (item) => item.song!.id.toString(),
                renderFn: (item) => (
                    <SongChip
                        value={item.song!}
                        startAdornment={gIconMap.MusicNote()}
                        useHashedColor
                    />
                ),
                getlabel: (item) => item.song!.name,
            },
            {
                id: ActivityDetailTabId.event,
                label: "Events",
                filterFn: (item) => !!item.event,
                keyFn: (item) => item.event!.id.toString(),
                renderFn: (item) => (
                    <EventChip
                        value={item.event!}
                        startAdornment={gIconMap.CalendarMonth()}
                        useHashedColor
                    />
                ),
                getlabel: (item) => item.event!.name,
            },
            {
                id: ActivityDetailTabId.wikiPage,
                label: "Wiki pages",
                filterFn: (item) => !!item.wikiPage,
                keyFn: (item) => item.wikiPage!.id.toString(),
                renderFn: (item) => (
                    <WikiPageChip
                        slug={item.wikiPage!.slug}
                        startAdornment={gIconMap.Article()}
                        useHashedColor
                    />
                ),
                getlabel: (item) => item.wikiPage!.slug,
            },
            {
                id: ActivityDetailTabId.file,
                label: "Files",
                filterFn: (item) => !!item.file,
                keyFn: (item) => item.file!.id.toString(),
                renderFn: (item) => (
                    <FileChip
                        value={item.file!}
                        startAdornment={gIconMap.AttachFile()}
                        useHashedColor
                    />
                ),
                getlabel: (item) => item.file!.fileLeafName,
            },
            {
                id: ActivityDetailTabId.context,
                label: "Contexts",
                filterFn: (item) => !!item.context,
                keyFn: (item) => item.context || "",
                renderFn: (item) => <ContextLabel value={item.context!} />,
                getlabel: (item) => item.context!,
            },
            {
                id: ActivityDetailTabId.attendance,
                label: "Attendance",
                filterFn: (item) => !!item.attendanceId,
                keyFn: (item) => item.attendanceId!.toString(),
                renderFn: (item) => <AttendanceChip value={item.attendanceId!} />,
                getlabel: (item) => {
                    const att = dashboardContext.eventAttendance.getById(item.attendanceId!);
                    return att?.text!;
                },
            },
            {
                id: ActivityDetailTabId.customLink,
                label: "Custom Links",
                filterFn: (item) => !!item.customLinkId,
                keyFn: (item) => item.customLinkId!.toString(),
                renderFn: (item) => <CMChip>Custom Link #{item.customLinkId}</CMChip>,
                getlabel: (item) => item.customLink?.name!,
            },
            {
                id: ActivityDetailTabId.setlist,
                label: "Setlists",
                filterFn: (item) => !!item.eventSongListId,
                keyFn: (item) => item.eventSongListId!.toString(),
                renderFn: (item) => <CMChip>Setlist #{item.eventSongListId}</CMChip>,
                getlabel: (item) => item.eventSongListId!.toString(),
            },
            {
                id: ActivityDetailTabId.frontpageGalleryItem,
                label: "Frontpage Gallery Items",
                filterFn: (item) => !!item.frontpageGalleryItemId,
                keyFn: (item) => item.frontpageGalleryItemId!.toString(),
                renderFn: (item) => <CMChip>Gallery Item #{item.frontpageGalleryItemId}</CMChip>,
                getlabel: (item) => item.frontpageGalleryItemId!.toString(),
            },
            {
                id: ActivityDetailTabId.menuLink,
                label: "Menu Links",
                filterFn: (item) => !!item.menuLinkId,
                keyFn: (item) => item.menuLinkId!.toString(),
                renderFn: (item) => <CMChip>Menu Link #{item.menuLinkId}</CMChip>,
                getlabel: (item) => item.menuLink?.caption!,
            },
            {
                id: ActivityDetailTabId.setlistPlan,
                label: "Setlist Plans",
                filterFn: (item) => !!item.setlistPlanId,
                keyFn: (item) => item.setlistPlanId!.toString(),
                renderFn: (item) => <CMChip>Setlist Plan #{item.setlistPlanId}</CMChip>,
                getlabel: (item) => item.setlistPlan?.name!,
            },
            {
                id: ActivityDetailTabId.songCreditType,
                label: "Song Credit Types",
                filterFn: (item) => !!item.songCreditTypeId,
                keyFn: (item) => item.songCreditTypeId!.toString(),
                renderFn: (item) => <CMChip>Song Credit Type #{item.songCreditTypeId}</CMChip>,
                getlabel: (item) => {
                    const creditType = dashboardContext.songCreditType.getById(item.songCreditTypeId!);
                    return creditType?.text!;
                },
            },
            {
                id: ActivityDetailTabId.instrument,
                label: "Instruments",
                filterFn: (item) => !!item.instrumentId,
                keyFn: (item) => item.instrumentId!.toString(),
                renderFn: (item) => <InstrumentChip value={item.instrumentId!} />,
                getlabel: (item) => {
                    const instrument = dashboardContext.instrument.getById(item.instrumentId!);
                    return instrument?.name!;
                },
            },
            {
                id: ActivityDetailTabId.screenSize,
                label: "Screen Size",
                filterFn: (item) => !!item.screenWidth && !!item.screenHeight,
                keyFn: (item) => {
                    return `${item.screenWidth}x${item.screenHeight}`;
                },
                renderFn: (item) => <CMChip>{item.screenWidth}x{item.screenHeight}</CMChip>,
                getlabel: (item) => {
                    return `${item.screenWidth}x${item.screenHeight}`;
                }
            },
            {
                id: ActivityDetailTabId.operatingSystem,
                label: "Operating System",
                filterFn: (item) => !!item.operatingSystem,
                keyFn: (item) => {
                    return item.operatingSystem!;
                },
                renderFn: (item) => <CMChip>{item.operatingSystem}</CMChip>,
                getlabel: (item) => {
                    return item.operatingSystem!;
                }
            },
            {
                id: ActivityDetailTabId.pointerType,
                label: "Pointer type",
                filterFn: (item) => !!item.pointerType,
                keyFn: (item) => {
                    return item.pointerType!;
                },
                renderFn: (item) => <CMChip>{item.pointerType}</CMChip>,
                getlabel: (item) => {
                    return item.pointerType!;
                }
            },
            {
                id: ActivityDetailTabId.browser,
                label: "Browser",
                filterFn: (item) => !!item.browserName,
                keyFn: (item) => {
                    return item.browserName!;
                },
                renderFn: (item) => <CMChip>{item.browserName}</CMChip>,
                getlabel: (item) => {
                    return item.browserName!;
                }
            },
            {
                id: ActivityDetailTabId.deviceClass,
                label: "Device type",
                filterFn: (item) => !!item.deviceClass,
                keyFn: (item) => {
                    return item.deviceClass!;
                },
                renderFn: (item) => <CMChip>{item.deviceClass}</CMChip>,
                getlabel: (item) => {
                    return item.deviceClass!;
                }
            },

            {
                id: ActivityDetailTabId.language,
                label: "Language",
                filterFn: (item) => !!item.language,
                keyFn: (item) => {
                    return item.language!;
                },
                renderFn: (item) => <CMChip>{item.language}</CMChip>,
                getlabel: (item) => {
                    return item.language!;
                }
            },

            {
                id: ActivityDetailTabId.locale,
                label: "Locale",
                filterFn: (item) => !!item.locale,
                keyFn: (item) => {
                    return item.locale!;
                },
                renderFn: (item) => <CMChip>{item.locale}</CMChip>,
                getlabel: (item) => {
                    return item.locale!;
                }
            },

            {
                id: ActivityDetailTabId.timezone,
                label: "Timezone",
                filterFn: (item) => !!item.timezone,
                keyFn: (item) => {
                    return item.timezone!;
                },
                renderFn: (item) => <CMChip>{item.timezone}</CMChip>,
                getlabel: (item) => {
                    return item.timezone!;
                }
            },

        ];

        const data = detail?.data ?? [];

        // 2) Iterate through each config to build the final tabs
        return tabConfigs.reduce<ContextObjectTabData[]>((acc, cfg) => {
            // Filter data for the current tab type
            const filtered = data.filter(cfg.filterFn);
            // Then gather context objects using your existing function
            const items = getContextObjectTabData(filtered, cfg.keyFn, cfg.getlabel, cfg.renderFn);

            if (items.length > 0) {
                acc.push({
                    id: cfg.id,
                    tabHeader: `${cfg.label} (${items.length})`,
                    items,
                    onIsolateFeature,
                    onExcludeFeature,
                    onFilterContext,
                });
            }
            return acc;
        }, []);
    }, [detail]);

    const renderedTabs: CMTabPanelChild[] = [
        <CMTab key={9999} thisTabId="general" summaryTitle={`General (${detail?.data.length})`} >
            <GeneralFeatureDetailTable data={detail?.data || []} onExcludeFeature={onExcludeFeature} onIsolateFeature={onIsolateFeature} onFilterContext={onFilterContext} />
        </CMTab>,
        ...tabs.map((tab) => <CMTab key={tab.id} thisTabId={tab.id} summaryTitle={tab.tabHeader} enabled={tab.items.length > 1} >
            <DistinctContextObjectTabContent key={tab.id} item={tab} />
        </CMTab>),
    ];

    const bucketDateRange = bucket ? parseBucketToDateRange(bucket, aggregateBy) : null;

    return <div>
        <div className="bucketLabel">
            {bucket && <>
                {bucket} [{bucketDateRange?.start.toLocaleString()} - {bucketDateRange?.end.toLocaleString()}] (range: {formatMillisecondsToDHMS(bucketDateRange!.end.getTime() - bucketDateRange!.start.getTime())})
            </>
            }
            {!bucket && <>No bucket selected</>}
        </div>
        <CMTabPanel handleTabChange={(e, newTabId: ActivityDetailTabId) => setTabId(newTabId)} selectedTabId={tabId} >
            {renderedTabs}
        </CMTabPanel>
    </div>;
};
