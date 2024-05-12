import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Button } from "@mui/material";
import React from "react";
import { ColorPaletteEntry, ColorVariationSpec, StandardVariationSpec } from "shared/color";
import { toggleValueInArray } from "shared/utils";
import { CMChip, CMChipBorderOption, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMCoreComponents";
import { SearchInput } from "src/core/components/CMTextField";

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
                </div>
            </div>
        </div>{/* content */}
        <div className="queryProgressLine idle"></div>
    </div>
};

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