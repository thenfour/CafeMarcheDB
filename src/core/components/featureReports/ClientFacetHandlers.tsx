import { clearArray, isOneOf } from "@/shared/arrayUtils";
import { gGeneralPaletteList } from "@/shared/color";
import { getHashedColor } from "@/shared/utils";
import { gIconMap } from "../../db3/components/IconMap";
import { SongChip, WikiPageChip } from "../CMCoreComponents";
import { CMSmallButton } from "../CMCoreComponents2";
//
import { FacetedBreakdownResult, FacetResultBase } from "./activityReportTypes";
import { ActivityFeature, OperatingSystem } from "./activityTracking";
import { AnonymizedUserChip, BrowserChip, CMAdhocChip, CMAdhocChipContainer, ContextLabel, DeviceClassChip, FeatureLabel, getColorForFeature, OperatingSystemChip, PointerTypeChip } from "./FeatureReportBasics";
import { FeatureReportFilterSpec } from "./server/facetProcessor";
import { EventChip } from "../event/EventChips";
import React, { Key } from "react";


interface ScreenSizeIndicatorProps {
    screenWidth: number;
    screenHeight: number;
    maxScreenWidth: number;
    maxScreenHeight: number;
    renderWidth: number;
    renderHeight: number;
}

/**
 * Renders a simple visual representation of a screen size as a box,
 * scaled to fit inside the given render dimensions.
 */
export default function ScreenSizeIndicator({
    screenWidth,
    screenHeight,
    maxScreenWidth,
    maxScreenHeight,
    renderWidth,
    renderHeight,
}: ScreenSizeIndicatorProps) {
    // Normalize screen dimensions to max bounds
    //const widthRatio = screenWidth / maxScreenWidth;
    //const heightRatio = screenHeight / maxScreenHeight;

    // Determine final rendered size, keeping aspect ratio correct
    const scaleFactor = Math.min(renderWidth / maxScreenWidth, renderHeight / maxScreenHeight);
    const displayWidth = screenWidth * scaleFactor;
    const displayHeight = screenHeight * scaleFactor;

    return (
        <div
            className="relative flex items-center justify-center"
            style={{
                width: renderWidth,
                height: renderHeight,
                backgroundColor: "#f3f4f6", // Tailwind gray-100
                border: "1px solid #d1d5db", // Tailwind gray-300
                borderRadius: 4,
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    width: displayWidth,
                    height: displayHeight,
                    backgroundColor: "#3b82f6", // Tailwind blue-500
                    border: "2px solid #2563eb", // Tailwind blue-600
                    borderRadius: 2,
                }}
                title={`${screenWidth} × ${screenHeight}`}
            />
        </div>
    );
}




export interface FacetHandlerRenderItemProps<Tpayload extends FacetResultBase, TKey> {
    item: Tpayload;
    filterSpec: FeatureReportFilterSpec;
    setFilterSpec: (fs: FeatureReportFilterSpec) => void;
    reason: "filterItem" | "facetItemSummaryHeader" | "facetItemDetailHeader";
    handler: FacetHandler<Tpayload, TKey>;
};

export interface FacetHandlerRenderFilterProps<Tpayload extends FacetResultBase, TKey> {
    filterSpec: FeatureReportFilterSpec;
    setFilterSpec: (fs: FeatureReportFilterSpec) => void;
    handler: FacetHandler<Tpayload, TKey>;
};

// key must be comparable, hashable, uniquely identify facet items, immutable, not null
export interface FacetHandler<Tpayload extends FacetResultBase, TKey> {
    supportsDrilldown: boolean;
    getFacetName: () => string;
    addFilter: (filterSpec: FeatureReportFilterSpec, item: Tpayload) => FeatureReportFilterSpec; // apply a filter to the incoming filterspec for the given item.
    includedItemsSelector: (filterSpec: FeatureReportFilterSpec) => TKey[];
    excludedItemsSelector: (filterSpec: FeatureReportFilterSpec) => TKey[];

    itemFromKey: (key: TKey) => Tpayload;
    getItemKey: (item: Tpayload) => TKey;
    getItemLabel: (item: Tpayload) => string;
    getItemColor: (item: Tpayload, alpha?: string) => string;
    renderItem: React.FC<FacetHandlerRenderItemProps<Tpayload, TKey>>;
    renderFilter: React.FC<FacetHandlerRenderFilterProps<Tpayload, TKey>>;
};

// renders a single item, with buttons to isolate or hide the item
type FacetItemRenderHelperProps<Tpayload extends FacetResultBase, TKey> = React.PropsWithChildren<FacetHandlerRenderItemProps<Tpayload, TKey>>;

const FacetItemRenderHelper = <Tpayload extends FacetResultBase, TKey>({ item, handler, ...props }: FacetItemRenderHelperProps<Tpayload, TKey>) => {
    const isolateButton = <CMSmallButton
        variant="technical"
        onClick={(e) => {
            const newFilterSpec = { ...props.filterSpec };
            const includedItems = handler.includedItemsSelector(newFilterSpec);
            const excludedItems = handler.excludedItemsSelector(newFilterSpec);
            clearArray(includedItems);
            clearArray(excludedItems);
            includedItems.push(handler.getItemKey(item));
            props.setFilterSpec(newFilterSpec);
        }}
    >
        [+] isolate
    </CMSmallButton>;

    const hideButton = <CMSmallButton
        variant="technical"
        onClick={(e) => {
            // add to exclude list
            const newFilterSpec = { ...props.filterSpec };
            const excludedItems = handler.excludedItemsSelector(newFilterSpec);

            // ensure excludedItems contains the item's filter key.
            const itemKey = handler.getItemKey(item);
            if (!excludedItems.includes(itemKey)) {
                excludedItems.push(itemKey);
            }

            //console.log(`newFilterSpec with excluded feature`, newFilterSpec);
            props.setFilterSpec(newFilterSpec);
        }}
    >
        [-] hide
    </CMSmallButton>;

    return <CMAdhocChipContainer>
        {props.children}
        <div style={{ flexGrow: 1 }} />
        {isOneOf(props.reason, "facetItemSummaryHeader") && handler.supportsDrilldown && isolateButton}
        {isOneOf(props.reason, "facetItemSummaryHeader") && handler.supportsDrilldown && hideButton}
    </CMAdhocChipContainer>;
}

const FilterItemRenderHelper = <Tpayload extends FacetResultBase, TKey extends Key>({ handler, setFilterSpec, filterSpec, ...props }: FacetHandlerRenderFilterProps<Tpayload, TKey>) => {
    const includedItems = handler.includedItemsSelector(filterSpec);
    const excludedItems = handler.excludedItemsSelector(filterSpec);
    if (includedItems.length === 0 && excludedItems.length === 0) return null;
    return <>
        {includedItems.length > 0 && <CMAdhocChipContainer>
            <CMAdhocChip>
                Included {handler.getFacetName()}
            </CMAdhocChip>
            <CMAdhocChip onClick={() => {
                const newFilterSpec = { ...filterSpec };
                const included = handler.includedItemsSelector(filterSpec);
                clearArray(included);
                setFilterSpec(newFilterSpec);
            }}>
                [x] Clear
            </CMAdhocChip>
            {includedItems.map((itemKey) => {
                return <React.Fragment key={itemKey}>{handler.renderItem({
                    filterSpec,
                    setFilterSpec,
                    reason: "filterItem",
                    handler,
                    item: handler.itemFromKey(itemKey),
                })}</React.Fragment>
            })}
        </CMAdhocChipContainer>}
        {excludedItems.length > 0 && <CMAdhocChipContainer>
            <CMAdhocChip>Exclude {handler.getFacetName()}</CMAdhocChip>
            <CMAdhocChip onClick={() => {
                const newFilterSpec = { ...filterSpec };
                const included = handler.excludedItemsSelector(filterSpec);
                clearArray(included);
                setFilterSpec(newFilterSpec);
            }}>
                [x] Clear
            </CMAdhocChip>
            {excludedItems.map((itemKey) => {
                return handler.renderItem({
                    filterSpec,
                    setFilterSpec,
                    reason: "filterItem",
                    handler,
                    item: handler.itemFromKey(itemKey),
                });
            })}
        </CMAdhocChipContainer>}
    </>;
};

const MakeHandler = <Tpayload extends FacetResultBase, Tkey>(val: FacetHandler<Tpayload, Tkey>) => val;

export const gClientFacetHandlers = {

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    features: MakeHandler<FacetedBreakdownResult['facets']['features'][0], ActivityFeature | string>({
        getItemKey: (item) => item.feature,
        getFacetName: () => "Feature",
        getItemLabel: (item) => item.feature,
        supportsDrilldown: true,
        excludedItemsSelector: (filterSpec) => filterSpec.excludeFeatures,
        includedItemsSelector: (filterSpec) => filterSpec.includeFeatures,
        itemFromKey: (itemKey) => ({
            feature: itemKey,
            count: 0,
        }),
        getItemColor: (item, alpha) => {
            const colorName = getColorForFeature(item.feature);
            const entry = gGeneralPaletteList.findEntry(colorName)!;
            if (alpha) return entry.strong.backgroundColor;
            return entry.strong.foregroundColor;
        },
        addFilter: (filterSpec, item) => {

            const feature = item.feature;
            const isKnownFeature = isOneOf(feature, ...Object.values(ActivityFeature));
            if (!isKnownFeature) {
                console.warn(`Unknown feature ${item.feature} in filterSpec`, filterSpec);
                return filterSpec;
            }

            return {
                ...filterSpec,
                includeFeatures: [feature],
            };
        },
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <FeatureLabel feature={props.item.feature} />
            </FacetItemRenderHelper >;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        },
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    contexts: MakeHandler<FacetedBreakdownResult['facets']['contexts'][0], string>({
        getItemKey: (item) => item.context,
        getFacetName: () => "Context",
        getItemLabel: (item) => item.context,
        supportsDrilldown: true,
        excludedItemsSelector: (filterSpec) => [],
        includedItemsSelector: (filterSpec) => [],
        itemFromKey: (itemKey) => ({
            context: itemKey,
            count: 0,
        }),
        getItemColor: (item, alpha) => getHashedColor(item.context, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                contextBeginsWith: item.context,
            };
        },

        renderItem: ({ item, filterSpec, setFilterSpec, handler }) => {
            return <ContextLabel
                value={item.context}
                onClickPart={(part) => {
                    setFilterSpec({ ...filterSpec, contextBeginsWith: part });
                }}
            />;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        },
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    operatingSystems: MakeHandler<FacetedBreakdownResult['facets']['operatingSystems'][0], OperatingSystem | string>({
        getItemKey: (item) => item.operatingSystem,
        getFacetName: () => "Operating System",
        getItemLabel: (item) => item.operatingSystem,
        supportsDrilldown: true,
        getItemColor: (item, alpha) => getHashedColor(item.operatingSystem, { alpha }),
        excludedItemsSelector: (filterSpec) => filterSpec.excludeOperatingSystems,
        includedItemsSelector: (filterSpec) => filterSpec.includeOperatingSystems,
        itemFromKey: (itemKey) => ({
            operatingSystem: itemKey,
            count: 0,
        }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                operatingSystem: item.operatingSystem,
            };
        },
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <OperatingSystemChip value={props.item.operatingSystem} />
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => <FilterItemRenderHelper {...props} />,
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    pointerTypes: MakeHandler<FacetedBreakdownResult['facets']['pointerTypes'][0], FacetedBreakdownResult['facets']['pointerTypes'][0]['pointerType']>({
        getItemKey: (item) => item.pointerType,
        getFacetName: () => "Pointer Type",
        getItemLabel: (item) => item.pointerType,
        supportsDrilldown: true,
        getItemColor: (item, alpha) => getHashedColor(item.pointerType, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                pointerType: item.pointerType,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludePointerTypes,
        includedItemsSelector: (filterSpec) => filterSpec.includePointerTypes,
        itemFromKey: (itemKey) => ({
            pointerType: itemKey,
            count: 0,
        }),
        renderItem: (props) => <FacetItemRenderHelper {...props}>
            <PointerTypeChip value={props.item.pointerType} />
        </FacetItemRenderHelper>,
        renderFilter: (props) => <FilterItemRenderHelper {...props} />,
    }),

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    browsers: MakeHandler<FacetedBreakdownResult['facets']['browsers'][0], FacetedBreakdownResult['facets']['browsers'][0]['browserName']>({
        getItemKey: (item) => item.browserName,
        getFacetName: () => "Browser",
        getItemLabel: (item) => item.browserName,
        supportsDrilldown: true,
        getItemColor: (item, alpha) => {
            return getHashedColor(item.browserName, { alpha });
        },
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                browserName: item.browserName,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeBrowserNames,
        includedItemsSelector: (filterSpec) => filterSpec.includeBrowserNames,
        itemFromKey: (itemKey) => ({
            browserName: itemKey,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <BrowserChip value={props.item.browserName} />
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => <FilterItemRenderHelper {...props} />,
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    deviceClasses: MakeHandler<FacetedBreakdownResult['facets']['deviceClasses'][0], FacetedBreakdownResult['facets']['deviceClasses'][0]['deviceClass']>({
        getItemKey: (item) => item.deviceClass,
        getFacetName: () => "Device Class",
        getItemLabel: (item) => item.deviceClass,
        supportsDrilldown: true,
        getItemColor: (item, alpha) => getHashedColor(item.deviceClass, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                deviceClass: item.deviceClass,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeDeviceClasses,
        includedItemsSelector: (filterSpec) => filterSpec.includeDeviceClasses,
        itemFromKey: (itemKey) => ({
            deviceClass: itemKey,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <DeviceClassChip value={props.item.deviceClass} />
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => <FilterItemRenderHelper {...props} />,
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    customLinks: MakeHandler<FacetedBreakdownResult['facets']['customLinks'][0], number>({
        getItemKey: (item) => item.customLinkId,
        getFacetName: () => "Custom Link",
        getItemLabel: (item) => item.customLinkId.toString(),
        supportsDrilldown: true,
        getItemColor: (item, alpha) => getHashedColor(item.customLinkId.toString(), { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                customLinkId: item.customLinkId,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeCustomLinkIds,
        includedItemsSelector: (filterSpec) => filterSpec.includeCustomLinkIds,
        itemFromKey: (itemKey) => ({
            customLinkId: itemKey,
            name: `#${itemKey.toString()}`,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <CMAdhocChip style={{ color: getHashedColor(props.item.customLinkId.toString()) }} >
                    <span style={{ fontFamily: "var(--ff-mono)" }}>#{props.item.customLinkId}</span>
                </CMAdhocChip>
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        },
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    menuLinks: MakeHandler<FacetedBreakdownResult['facets']['menuLinks'][0], number>({
        getItemKey: (item) => item.menuLinkId,
        getItemLabel: (item) => item.menuLinkId.toString(),
        getFacetName: () => "Menu Link",
        supportsDrilldown: true,
        getItemColor: (item, alpha) => getHashedColor(item.menuLinkId.toString(), { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                menuLinkId: item.menuLinkId,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeMenuLinkIds,
        includedItemsSelector: (filterSpec) => filterSpec.includeMenuLinkIds,
        itemFromKey: (itemKey) => ({
            menuLinkId: itemKey,
            name: `#${itemKey.toString()}`,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <CMAdhocChip style={{ color: getHashedColor(props.item.menuLinkId.toString()) }} >
                    <span style={{ fontFamily: "var(--ff-mono)" }}>#{props.item.menuLinkId}</span>
                </CMAdhocChip>
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        },
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    songs: MakeHandler<FacetedBreakdownResult['facets']['songs'][0], number>({
        getItemKey: (item) => item.songId,
        getFacetName: () => "Song",
        getItemLabel: (item) => item.name,
        supportsDrilldown: true,
        getItemColor: (item, alpha) => getHashedColor(item.songId.toString(), { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                songId: item.songId,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeSongIds,
        includedItemsSelector: (filterSpec) => filterSpec.includeSongIds,
        itemFromKey: (itemKey) => ({
            songId: itemKey,
            name: `#${itemKey.toString()}`,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <SongChip value={{ ...props.item, id: props.item.songId }} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        },
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    events: MakeHandler<FacetedBreakdownResult['facets']['events'][0], number>({
        getItemKey: (item) => item.eventId,
        getFacetName: () => "Event",
        supportsDrilldown: true,
        getItemLabel: (item) => item.name,
        getItemColor: (item, alpha) => getHashedColor(item.eventId.toString(), { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                eventId: item.eventId,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeEventIds,
        includedItemsSelector: (filterSpec) => filterSpec.includeEventIds,
        itemFromKey: (itemKey) => ({
            eventId: itemKey,
            name: `#${itemKey.toString()}`,
            startsAt: null,
            statusId: null,
            typeId: null,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <EventChip value={{ ...props.item, id: props.item.eventId }} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        },
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    wikiPages: MakeHandler<FacetedBreakdownResult['facets']['wikiPages'][0], number>({
        getItemKey: (item) => item.wikiPageId,
        getFacetName: () => "Wiki Page",
        getItemLabel: (item) => item.slug,
        supportsDrilldown: true,
        getItemColor: (item, alpha) => getHashedColor(item.slug, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                wikiPageId: item.wikiPageId,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeWikiPageIds,
        includedItemsSelector: (filterSpec) => filterSpec.includeWikiPageIds,
        itemFromKey: (itemKey) => ({
            wikiPageId: itemKey,
            slug: `#${itemKey.toString()}`,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <WikiPageChip slug={props.item.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        },
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    users: MakeHandler<FacetedBreakdownResult['facets']['users'][0], string>({
        getItemKey: (item) => item.userHash,
        getFacetName: () => "User",
        getItemLabel: (item) => item.userHash.substring(0, 8),
        supportsDrilldown: false,
        getItemColor: (item, alpha) => getHashedColor(item.userHash, { alpha }),
        addFilter: (filterSpec, item) => {
            throw new Error("Not supported");
        },
        excludedItemsSelector: (filterSpec) => [],
        includedItemsSelector: (filterSpec) => [],
        itemFromKey: (itemKey) => ({
            userHash: itemKey,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <AnonymizedUserChip value={props.item.userHash} />
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        },
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    timezones: MakeHandler<FacetedBreakdownResult['facets']['timezones'][0], FacetedBreakdownResult['facets']['timezones'][0]['timezone']>({
        getItemKey: (item) => item.timezone,
        supportsDrilldown: true,
        getFacetName: () => "Timezone",
        getItemLabel: (item) => item.timezone,
        getItemColor: (item, alpha) => getHashedColor(item.timezone, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                timezone: item.timezone,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeTimezones,
        includedItemsSelector: (filterSpec) => filterSpec.includeTimezones,
        itemFromKey: (itemKey) => ({
            timezone: itemKey,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <CMAdhocChip style={{ color: getHashedColor(props.item.timezone) }} ><span style={{ fontSize: "22px", fontWeight: "bold" }}>{props.item.timezone}</span></CMAdhocChip>
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        }
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    languages: MakeHandler<FacetedBreakdownResult['facets']['languages'][0], FacetedBreakdownResult['facets']['languages'][0]['language']>({
        getItemKey: (item) => item.language,
        getFacetName: () => "Language",
        supportsDrilldown: true,
        getItemLabel: (item) => item.language,
        getItemColor: (item, alpha) => getHashedColor(item.language, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                language: item.language,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeLanguages,
        includedItemsSelector: (filterSpec) => filterSpec.includeLanguages,
        itemFromKey: (itemKey) => ({
            language: itemKey,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <CMAdhocChip style={{ color: getHashedColor(props.item.language) }} ><span style={{ fontSize: "22px", fontWeight: "bold" }}>{props.item.language.toUpperCase()}</span></CMAdhocChip>
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        }
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    locales: MakeHandler<FacetedBreakdownResult['facets']['locales'][0], FacetedBreakdownResult['facets']['locales'][0]['locale']>({
        getItemKey: (item) => item.locale,
        getFacetName: () => "Locale",
        getItemLabel: (item) => item.locale,
        supportsDrilldown: true,
        getItemColor: (item, alpha) => getHashedColor(item.locale, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                locale: item.locale,
            };
        },
        excludedItemsSelector: (filterSpec) => filterSpec.excludeLocales,
        includedItemsSelector: (filterSpec) => filterSpec.includeLocales,
        itemFromKey: (itemKey) => ({
            locale: itemKey,
            count: 0,
        }),
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <CMAdhocChip style={{ color: getHashedColor(props.item.locale) }} ><span style={{ fontSize: "22px", fontWeight: "bold" }}>{props.item.locale.toUpperCase()}</span></CMAdhocChip>
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        }
    }),

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    screenSizes: MakeHandler<FacetedBreakdownResult['facets']['screenSizes'][0], string>({
        getItemKey: (item) => `${item.width}x${item.height}`,
        getFacetName: () => "Screen Size",
        supportsDrilldown: false,
        getItemLabel: (item) => `${item.width}x${item.height}`,
        getItemColor: (item, alpha) => getHashedColor(`${item.width}x${item.height}`, { alpha }),
        addFilter: (filterSpec, item) => {
            return {
                ...filterSpec,
                screenWidth: item.width,
                screenHeight: item.height,
            };
        },
        excludedItemsSelector: (filterSpec) => [],
        includedItemsSelector: (filterSpec) => [],
        itemFromKey: (itemKey) => {
            throw new Error("Not implemented");
        },
        renderItem: (props) => {
            return <FacetItemRenderHelper {...props}>
                <CMAdhocChip style={{ color: getHashedColor(props.item.width.toString()) }} startIcon={<ScreenSizeIndicator
                    screenHeight={props.item.height}
                    screenWidth={props.item.width}
                    maxScreenWidth={1920}
                    maxScreenHeight={1080}
                    renderWidth={40}
                    renderHeight={30}
                />}>
                    <span style={{ fontSize: "22px", fontWeight: "bold" }}>{props.item.width}x{props.item.height}</span></CMAdhocChip>
            </FacetItemRenderHelper>;
        },
        renderFilter: (props) => {
            return <FilterItemRenderHelper {...props} />
        }
    }),
} as const;

