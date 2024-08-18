import React from 'react';
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from './CMChip';

interface Option<TValue> {
    value: TValue;
    label: string;
    color?: string;
}

interface ChipSelectorProps<TValue> {
    options: Option<TValue>[];
    value: TValue;
    onChange: (val: TValue | null) => void;
    editable: boolean;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
    getItemInfo?: (option: Option<TValue>) => { color?: string; label?: string };
}

export const ChipSelector = <TValue,>({
    options,
    value,
    onChange,
    editable,
    getItemInfo,
    ...props
}: ChipSelectorProps<TValue>) => {

    const handleClick = (option: Option<TValue>) => {
        onChange(option.value);
    };

    return (
        <div className="chip-selector">
            <CMChipContainer className="constEnumStringFieldOptions">
                {options.map(option => {
                    let color = option.color;
                    let label = option.label;

                    if (getItemInfo) {
                        const itemInfo = getItemInfo(option);
                        color = itemInfo.color || color;
                        label = itemInfo.label || label;
                    }

                    const isSelected = value === option.value;

                    return (
                        <CMChip
                            key={option.value as any}
                            className={`selectable option ${isSelected ? "selected" : "notSelected"}`}
                            onClick={() => handleClick(option)}
                            color={color}
                            size={props.size}
                            shape={props.shape}
                            variation={{
                                selected: isSelected,
                                fillOption: "filled",
                                variation: "strong",
                                enabled: editable,
                            }}
                        >
                            {label}
                        </CMChip>
                    );
                })}
            </CMChipContainer>
        </div>
    );
};

function enumToChipSelectorOptions<TEnum extends object>(enumObj: TEnum): Option<TEnum[keyof TEnum]>[] {
    return (Object.keys(enumObj) as Array<keyof TEnum>).map(key => ({
        value: enumObj[key],
        label: key.toString()
    }));
}

interface EnumChipSelectorProps<TEnum extends object> {
    enumObj: TEnum;
    value: TEnum[keyof TEnum];
    onChange: (val: TEnum[keyof TEnum] | null) => void;
    editable: boolean;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
    getItemInfo?: (option: Option<TEnum[keyof TEnum]>) => { color?: string; label?: string };
    filterOption?: (option: Option<TEnum[keyof TEnum]>) => boolean;
}

export const EnumChipSelector = <TEnum extends object,>({
    enumObj,
    value,
    onChange,
    editable,
    getItemInfo,
    filterOption,
    ...props
}: EnumChipSelectorProps<TEnum>) => {
    const options1 = enumToChipSelectorOptions(enumObj);
    const options = filterOption ? options1.filter(filterOption) : options1;

    return (
        <ChipSelector
            options={options}
            value={value}
            size={props.size}
            shape={props.shape}
            onChange={onChange}
            editable={editable}
            getItemInfo={getItemInfo}
        />
    );
};
