import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Button, Switch } from "@mui/material";
import React from "react";
import { ColorPaletteEntry, ColorVariationSpec, StandardVariationSpec, gGeneralPaletteList, gSwatchColors } from "shared/color";
import { toggleValueInArray } from "shared/utils";
import { SearchInput } from "src/core/components/CMTextField";
import { CalculateFilterQueryResult, DiscreteCriterion, DiscreteCriterionFilterType, SearchResultsFacetOption } from '../db3/shared/apiTypes';
import { gCharMap, gIconMap } from '../db3/components/IconMap';
import { OpposingSortDirection, SortDirection } from 'shared/rootroot';
import { CMChip, CMChipBorderOption, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from './CMChip';

type FilterControlsProps = {
    hasExtraFilters?: boolean; // default falsy
    hasAnyFilters: boolean;

    // optional quick filter
    quickFilterText?: string | undefined;
    onQuickFilterChange?: undefined | ((v: string) => void);

    onResetFilter: () => void;
    inCard: boolean;

    // renderers
    primaryFilter?: React.ReactNode;
    extraFilter?: React.ReactNode;
    footerFilter?: React.ReactNode;
};
export const FilterControls = (props: FilterControlsProps) => {
    const [expanded, setExpanded] = React.useState<boolean>(false);
    const expandable = !!props.extraFilter;

    return <div className={`filterControlsContainer ${props.inCard ? "inCard" : "asCard"}`}>
        <div className="content">
            <div className="row">
                <div className="filterControls">

                    <div className="row quickFilter">
                        {props.quickFilterText === undefined ? <div></div> :
                            <SearchInput
                                onChange={props.onQuickFilterChange!}
                                value={props.quickFilterText}
                                autoFocus={true}
                            />
                        }
                        {(props.hasAnyFilters) && <Button onClick={props.onResetFilter}>Reset filter</Button>}
                        {expandable && <div className="freeButton headerExpandableButton" onClick={() => setExpanded(!expanded)}>
                            Filter {props.hasExtraFilters && "*"}
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </div>}
                    </div>

                    <div className={`EventsFilterControlsValue`}>
                        <div className="row" style={{ display: "flex", alignItems: "center" }}>
                            {props.primaryFilter}
                        </div>
                    </div>

                    {expanded && props.extraFilter}
                    {props.footerFilter}
                </div>
            </div>
        </div>{/* content */}
        {/* <div className="queryProgressLine idle"></div> */}
    </div>
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface ChipFilterGroupItem<Tid> {
    id: Tid;
    label: React.ReactNode;

    variation?: ColorVariationSpec;
    color?: ColorPaletteEntry | string | null;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
    className?: string;
    tooltip?: string | null;
};

interface ChipFilterGroupProps<Tid> {
    items: ChipFilterGroupItem<Tid>[];
    selectedIds: Tid[];
    // radio = clicking existing selection does nothing.
    // radiotoggle = clicking exsiting selection removes it.
    // toggle = multiple selection; clicking toggles
    style: "radio" | "toggle" | "radiotoggle";
    onChange: (newSelection: Tid[]) => void;
};
export const ChipFilterGroup = <Tid extends number | string,>(props: ChipFilterGroupProps<Tid>) => {
    const handleClick = (item: ChipFilterGroupItem<Tid>) => {
        if (props.style === 'radio') {
            props.onChange([item.id]);
        } else if (props.style === "toggle") {
            props.onChange(toggleValueInArray(props.selectedIds, item.id));
        } else {
            if (props.selectedIds.includes(item.id)) {
                props.onChange([]);
            } else {
                props.onChange([item.id]);
            }
        }
    }
    return <CMChipContainer>
        {props.items.map(item => {
            const variation = item.variation || StandardVariationSpec.Strong;
            return <CMChip
                key={item.id}
                color={item.color}
                variation={{ ...variation, selected: props.selectedIds.includes(item.id) }}
                size={item.size || "small"}
                shape={item.shape}
                border={item.border}
                className={item.className}
                tooltip={item.tooltip}
                onClick={() => handleClick(item)}
            >
                {item.label}
            </CMChip>;
        })}
    </CMChipContainer>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface TagsFilterGroupProps {
    items: SearchResultsFacetOption[];
    value: DiscreteCriterion; // don't pass "alwaysmatch" here; this should be the value which is preserved while enabled=false.
    onChange: (v: DiscreteCriterion, enabled: boolean) => void; // callers should respect enabled by setting the behavior to AlwaysMatch when disabled.
    errorMessage: string | undefined; // from CalculateFilterQueryResult
    filterEnabled: boolean;
    style: "tags" | "foreignSingle" | "radio";

    label: React.ReactNode;
    className?: string;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
};
export const TagsFilterGroup = (props: TagsFilterGroupProps) => {
    //const [enabled, setEnabled] = React.useState<boolean>(() => props.value.behavior !== DiscreteCriterionFilterType.alwaysMatch);

    const handleClickFacet = (item: SearchResultsFacetOption) => {
        if (props.style === 'radio') {
            // clicking an item in radio mode sets the 1 option, done.
            props.onChange({
                ...props.value,
                behavior: DiscreteCriterionFilterType.hasAllOf,
                options: [item.id]
            }, true);
            return;
        }
        if (item.id === null) {
            // clicking null
            const newBehaviorMap: { [key in DiscreteCriterionFilterType]: DiscreteCriterionFilterType | undefined } = {
                "alwaysMatch": DiscreteCriterionFilterType.hasNone, // this shouldn't be possible anyay to click null when OFF
                "hasNone": undefined, // clicking null when "has none" is a nop.
                "hasAny": undefined, // 
                "hasSomeOf": DiscreteCriterionFilterType.hasNone,
                "hasAllOf": DiscreteCriterionFilterType.hasNone,
                "doesntHaveAnyOf": DiscreteCriterionFilterType.hasNone,
                "doesntHaveAllOf": DiscreteCriterionFilterType.hasNone,
            } as const;
            props.onChange({
                ...props.value,
                behavior: newBehaviorMap[props.value.behavior] || props.value.behavior,
                options: []
            }, true);
            return;
        }

        // clicking null will change multi-criteria to single (from hasSome to hasAny for example)
        const newBehaviorMap: { [key in DiscreteCriterionFilterType]: DiscreteCriterionFilterType | undefined } = {
            "alwaysMatch": DiscreteCriterionFilterType.hasSomeOf,
            "hasNone": DiscreteCriterionFilterType.hasSomeOf,
            "hasAny": DiscreteCriterionFilterType.hasSomeOf,
            "hasSomeOf": undefined,
            "hasAllOf": undefined,
            "doesntHaveAnyOf": undefined,
            "doesntHaveAllOf": undefined,
        } as const;

        if (!props.filterEnabled) {
            // clicking on items when the filter is disabled will enable it, select the 1 option.
            props.onChange({
                ...props.value,
                behavior: newBehaviorMap[props.value.behavior] || props.value.behavior,
                options: [item.id],
            }, true);
            return;
        }

        props.onChange({
            ...props.value,
            behavior: newBehaviorMap[props.value.behavior] || props.value.behavior,
            options: toggleValueInArray(props.value.options, item.id),
        }, true);
    }

    return <div className={`filterGroup ${props.errorMessage ? "alert" : "noalert"} ${props.filterEnabled ? "filterEnabled" : "filterDisabled"}`}>
        <div className='filterGroupHeader'>
            <div className='switchContainer'>
                <div className='filterGroupSwitch'>
                    {/* {JSON.stringify(props.filterEnabled)} */}
                    <Switch
                        size='small'
                        onChange={(e, checked) => {
                            props.onChange(props.value, checked);
                        }}
                        checked={props.filterEnabled}
                    />
                </div>
                <div className='filterGroupLabel'>{props.label}</div>
            </div>

            <div className='filterGroupOptions'>
                {props.style === 'foreignSingle' && <>
                    <div
                        className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.hasAny && props.filterEnabled && "selected"}`}
                        onClick={() => {
                            props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.hasAny }, true);
                        }}
                    >
                        Has any
                    </div>
                    <div
                        className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.hasNone && props.filterEnabled && "selected"}`}
                        onClick={() => {
                            props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.hasNone }, true);
                        }}
                    >
                        Has none
                    </div>
                    <div
                        className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.hasSomeOf && props.filterEnabled && "selected"}`}
                        onClick={() => {
                            props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.hasSomeOf }, true);
                        }}
                    >
                        Is any of
                    </div>
                    <div
                        className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.doesntHaveAnyOf && props.filterEnabled && "selected"}`}
                        onClick={() => {
                            props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.doesntHaveAnyOf }, true);
                        }}
                    >
                        Is not any of
                    </div>
                </>
                }


                {props.style === 'tags' &&
                    <>
                        <div
                            className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.hasNone && props.filterEnabled && "selected"}`}
                            onClick={() => {
                                props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.hasNone }, true);
                            }}
                        >
                            Have none
                        </div>

                        <div
                            className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.hasAny && props.filterEnabled && "selected"}`}
                            onClick={() => {
                                props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.hasAny }, true);
                            }}
                        >
                            Have any
                        </div>

                        <div
                            className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.hasSomeOf && props.filterEnabled && "selected"}`}
                            onClick={() => {
                                props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.hasSomeOf }, true);
                            }}
                        >
                            Have any of
                        </div>

                        <div
                            className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.hasAllOf && props.filterEnabled && "selected"}`}
                            onClick={() => {
                                props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.hasAllOf }, true);
                            }}
                        >
                            Have all of
                        </div>

                        <div
                            className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.doesntHaveAnyOf && props.filterEnabled && "selected"}`}
                            onClick={() => {
                                props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.doesntHaveAnyOf }, true);
                            }}
                        >
                            Don't have any of
                        </div>

                        <div
                            className={`option freeButton ${props.value.behavior === DiscreteCriterionFilterType.doesntHaveAllOf && props.filterEnabled && "selected"}`}
                            onClick={() => {
                                props.onChange({ ...props.value, behavior: DiscreteCriterionFilterType.doesntHaveAllOf }, true);
                            }}
                        >
                            Don't have all of
                        </div>
                    </>
                }
                <div className='horizDivider' />
            </div>
        </div>

        <CMChipContainer className={props.className} margins='tightMargins'>

            {props.items.map(item => {
                const variation = StandardVariationSpec.Strong;
                const isInOptions = props.value.options.includes(item.id);
                const enabled = props.filterEnabled;
                const nullIsSelected = (props.value.behavior === DiscreteCriterionFilterType.hasNone);
                const hasAnySelected = (props.value.behavior === DiscreteCriterionFilterType.hasAny);
                const selected = ((isInOptions && !nullIsSelected && !hasAnySelected) || (item.id === null && nullIsSelected));

                return <CMChip
                    key={item.id}
                    color={item.color}
                    variation={{ ...variation, selected: enabled && selected, enabled: enabled && (item.rowCount > 0) }}
                    size={props.size || "small"}
                    shape={props.shape || 'rectangle'}
                    border={'noBorder'}
                    tooltip={item.tooltip}
                    onClick={() => handleClickFacet(item)}
                >
                    <div className='filterChipLabelContainer'>
                        <div className='label'>{item.label || "-"}</div>
                        <div className='rowCount'>{item.rowCount}</div>
                    </div>
                </CMChip>;
            })}
        </CMChipContainer>

        {props.errorMessage && <div className='alertMessage'>{props.errorMessage}</div>}

    </div>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface SortBySpec {
    columnName: string;
    direction: SortDirection;
};

export interface SortByGroupProps {
    columnOptions: string[];
    value: SortBySpec;
    setValue: (v: SortBySpec) => void;
};

export const SortByGroup = (props: SortByGroupProps) => {

    return <div className='filterGroup'>
        <div className='filterGroupHeader'>
            <div className='filterGroupLabel'>Sort by</div>
            <div className='filterGroupOptions'>
                {
                    props.columnOptions.map(k => {
                        const selected = props.value.columnName === k;
                        return <div
                            key={k}
                            className={`option freeButton ${selected && "selected"}`}
                            onClick={() => {
                                if (selected) {
                                    props.setValue({ ...props.value, direction: OpposingSortDirection(props.value.direction) });
                                } else {
                                    props.setValue({ columnName: k, direction: "asc" });
                                }
                            }}
                        >
                            <div className="sortFieldName">
                                {k}
                            </div>
                            <div className="sortFieldDirection">
                                {selected && (props.value.direction === "asc" ? gCharMap.DownArrow() : gCharMap.UpArrow())}
                            </div>
                        </div>
                    })
                }
            </div>
        </div>
    </div>
};
