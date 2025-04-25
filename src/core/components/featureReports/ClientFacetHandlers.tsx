import { gGeneralPaletteList } from "@/shared/color";
import { FacetedBreakdownResult, FacetResultBase, FeatureReportFilterSpec } from "./activityReportTypes";
import { AnonymizedUserChip, BrowserChip, CMAdhocChip, CMAdhocChipContainer, ContextLabel, DeviceClassChip, FeatureLabel, getColorForFeature, OperatingSystemChip, PointerTypeChip } from "./FeatureReportBasics";
import { getHashedColor } from "@/shared/utils";
import { EventChip, SongChip, WikiPageChip } from "../CMCoreComponents";
import { gIconMap } from "../../db3/components/IconMap";
import ScreenSizeIndicator from "./FacetedBreakdown";

export interface FacetHandler<Tpayload extends FacetResultBase> {
    getItemKey: (item: Tpayload) => string;
    getFacetName: () => string;
    renderItem: (item: Tpayload) => React.ReactNode;
    getItemLabel: (item: Tpayload) => string;
    getItemColor: (item: Tpayload, alpha?: string) => string;
    supportsDrilldown: boolean; // if true, the item can be clicked to drill down to a new report.
    addFilter: (filterSpec: FeatureReportFilterSpec, item: Tpayload) => FeatureReportFilterSpec; // apply a filter to the incoming filterspec for the given item.
}

const MakeHandler = <Tpayload extends FacetResultBase,>(val: FacetHandler<Tpayload>) => val;

export const gClientFacetHandlers = {
    features: MakeHandler<FacetedBreakdownResult['facets']['features'][0]>({
        getItemKey: (item) => item.feature,
        getFacetName: () => "Feature",
        getItemLabel: (item) => item.feature,
        renderItem: (item) => {
            return <FeatureLabel feature={item.feature} />;
        },
        getItemColor: (item, alpha) => {
            const colorName = getColorForFeature(item.feature);
            const entry = gGeneralPaletteList.findEntry(colorName)!;
            if (alpha) return entry.strong.backgroundColor;
            return entry.strong.foregroundColor;
        },
        supportsDrilldown: true,
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                includeFeatures: [item.feature],
            };
        },
    }),
    contexts: MakeHandler<FacetedBreakdownResult['facets']['contexts'][0]>({
        getItemKey: (item) => item.context,
        getFacetName: () => "Context",
        getItemLabel: (item) => item.context,
        renderItem: (item) => {
            return <ContextLabel value={item.context} />;
        },
        getItemColor: (item, alpha) => getHashedColor(item.context, { alpha }),
        supportsDrilldown: true,
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                contextBeginsWith: item.context,
            };
        },
    }),
    operatingSystems: MakeHandler<FacetedBreakdownResult['facets']['operatingSystems'][0]>({
        getItemKey: (item) => item.operatingSystem,
        getFacetName: () => "Operating System",
        getItemLabel: (item) => item.operatingSystem,
        supportsDrilldown: true,
        renderItem: (item) => {
            return <CMAdhocChipContainer>
                <CMAdhocChip startIcon={<OperatingSystemChip value={item.operatingSystem} />}>
                    {item.operatingSystem}
                </CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.operatingSystem, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                operatingSystem: item.operatingSystem,
            };
        },
    }),
    pointerTypes: MakeHandler<FacetedBreakdownResult['facets']['pointerTypes'][0]>({
        getItemKey: (item) => item.pointerType,
        getFacetName: () => "Pointer Type",
        getItemLabel: (item) => item.pointerType,
        supportsDrilldown: true,
        renderItem: (item) => {
            return <CMAdhocChipContainer>

                <CMAdhocChip startIcon={<PointerTypeChip value={item.pointerType} />}>{item.pointerType}</CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.pointerType, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                pointerType: item.pointerType,
            };
        },
    }),
    browsers: MakeHandler<FacetedBreakdownResult['facets']['browsers'][0]>({
        getItemKey: (item) => item.browserName,
        getFacetName: () => "Browser",
        getItemLabel: (item) => item.browserName,
        supportsDrilldown: true,
        renderItem: (item) => {
            return <CMAdhocChipContainer>

                <CMAdhocChip startIcon={<BrowserChip value={item.browserName} />}>{item.browserName}</CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.browserName, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                browserName: item.browserName,
            };
        },
    }),
    deviceClasses: MakeHandler<FacetedBreakdownResult['facets']['deviceClasses'][0]>({
        getItemKey: (item) => item.deviceClass,
        getFacetName: () => "Device Class",
        getItemLabel: (item) => item.deviceClass,
        supportsDrilldown: true,
        renderItem: (item) => {
            return <CMAdhocChipContainer>
                <CMAdhocChip startIcon={<DeviceClassChip value={item.deviceClass} />}>{item.deviceClass}</CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.deviceClass, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                deviceClass: item.deviceClass,
            };
        },
    }),
    customLinks: MakeHandler<FacetedBreakdownResult['facets']['customLinks'][0]>({
        getItemKey: (item) => item.customLinkId.toString(),
        getFacetName: () => "Custom Link",
        getItemLabel: (item) => item.customLinkId.toString(),
        supportsDrilldown: true,
        renderItem: (item) => {
            return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.customLinkId}</span>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.customLinkId.toString(), { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                customLinkId: item.customLinkId,
            };
        },
    }),
    menuLinks: MakeHandler<FacetedBreakdownResult['facets']['menuLinks'][0]>({
        getItemKey: (item) => item.menuLinkId.toString(),
        getItemLabel: (item) => item.menuLinkId.toString(),
        getFacetName: () => "Menu Link",
        supportsDrilldown: true,
        renderItem: (item) => {
            return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.menuLinkId}</span>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.menuLinkId.toString(), { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                menuLinkId: item.menuLinkId,
            };
        },
    }),
    songs: MakeHandler<FacetedBreakdownResult['facets']['songs'][0]>({
        getItemKey: (item) => item.songId.toString(),
        getFacetName: () => "Song",
        getItemLabel: (item) => item.name,
        supportsDrilldown: true,
        renderItem: (item) => {
            //return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.songId}</span>;
            return <SongChip value={{ ...item, id: item.songId }} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />;
        },
        getItemColor: (item, alpha) => getHashedColor(item.songId.toString(), { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                songId: item.songId,
            };
        },
    }),
    events: MakeHandler<FacetedBreakdownResult['facets']['events'][0]>({
        getItemKey: (item) => item.eventId.toString(),
        getFacetName: () => "Event",
        supportsDrilldown: true,
        getItemLabel: (item) => item.name,
        renderItem: (item) => {
            //return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.eventId}</span>;
            return <EventChip value={{ ...item, id: item.eventId }} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />
        },
        getItemColor: (item, alpha) => getHashedColor(item.eventId.toString(), { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                eventId: item.eventId,
            };
        },
    }),
    wikiPages: MakeHandler<FacetedBreakdownResult['facets']['wikiPages'][0]>({
        getItemKey: (item) => item.wikiPageId.toString(),
        getFacetName: () => "Wiki Page",
        getItemLabel: (item) => item.slug,
        supportsDrilldown: true,
        renderItem: (item) => {
            //return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.wikiPageId}</span>;
            return <WikiPageChip slug={item.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />;
        },
        getItemColor: (item, alpha) => getHashedColor(item.slug, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                wikiPageId: item.wikiPageId,
            };
        },
    }),
    users: MakeHandler<FacetedBreakdownResult['facets']['users'][0]>({
        getItemKey: (item) => item.userHash,
        getFacetName: () => "User",
        getItemLabel: (item) => item.userHash.substring(0, 8),
        supportsDrilldown: false,
        renderItem: (item) => {
            return <AnonymizedUserChip value={item.userHash} />;
        },
        getItemColor: (item, alpha) => getHashedColor(item.userHash, { alpha }),
        addFilter: (filterSpec, item) => {
            throw new Error("Not supported");
        },
    }),
    timezones: MakeHandler<FacetedBreakdownResult['facets']['timezones'][0]>({
        getItemKey: (item) => item.timezone,
        supportsDrilldown: true,
        getFacetName: () => "Timezone",
        getItemLabel: (item) => item.timezone,
        renderItem: (item) => {
            return <span style={{ fontFamily: "var(--ff-mono)" }}>{item.timezone}</span>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.timezone, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                timezone: item.timezone,
            };
        },
    }),
    languages: MakeHandler<FacetedBreakdownResult['facets']['languages'][0]>({
        getItemKey: (item) => item.language,
        getFacetName: () => "Language",
        supportsDrilldown: true,
        getItemLabel: (item) => item.language,
        renderItem: (item) => {
            return <CMAdhocChipContainer>
                <CMAdhocChip style={{ color: getHashedColor(item.language) }} ><span style={{ fontSize: "22px", fontWeight: "bold" }}>{item.language.toUpperCase()}</span></CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.language, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                language: item.language,
            };
        },
    }),
    locales: MakeHandler<FacetedBreakdownResult['facets']['locales'][0]>({
        getItemKey: (item) => item.locale,
        getFacetName: () => "Locale",
        getItemLabel: (item) => item.locale,
        supportsDrilldown: true,
        renderItem: (item) => {
            return <CMAdhocChipContainer>
                <CMAdhocChip style={{ color: getHashedColor(item.locale) }} ><span style={{ fontSize: "22px", fontWeight: "bold" }}>{item.locale.toUpperCase()}</span></CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(item.locale, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                locale: item.locale,
            };
        },
    }),
    screenSizes: MakeHandler<FacetedBreakdownResult['facets']['screenSizes'][0]>({
        getItemKey: (item) => `${item.width}x${item.height}`,
        getFacetName: () => "Screen Size",
        supportsDrilldown: true,
        getItemLabel: (item) => `${item.width}x${item.height}`,
        renderItem: (item) => {

            return <CMAdhocChipContainer>
                <CMAdhocChip startIcon={<ScreenSizeIndicator
                    screenHeight={item.height}
                    screenWidth={item.width}
                    maxScreenWidth={1920}
                    maxScreenHeight={1080}
                    renderWidth={40}
                    renderHeight={30}
                />}>
                    <span style={{ fontSize: "22px", fontWeight: "bold" }}>{item.width}x{item.height}</span></CMAdhocChip>
            </CMAdhocChipContainer>;
        },
        getItemColor: (item, alpha) => getHashedColor(`${item.width}x${item.height}`, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                screenWidth: item.width,
                screenHeight: item.height,
            };
        },
    }),
} as const;

