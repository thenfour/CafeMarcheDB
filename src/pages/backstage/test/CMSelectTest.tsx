// todo: when inserted in dialog, the parent needs to refetch

import { BlitzPage } from "@blitzjs/next";
import React from "react";
import { gGeneralPaletteList } from "shared/color";
import { sleep } from "shared/utils";
import { CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { CMMultiSelect, CMSelectDisplayStyle, CMSingleSelect, StringArrayOptionsProvider } from "src/core/components/select/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/select/CMSingleSelectDialog";
import { ColorPick } from "src/core/components/ColorPick";
import { DB3MultiSelect, DB3SingleSelect } from "src/core/db3/components/db3Select";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";

type Dataset = "numbers";

interface ChipOptions {
    readonly: boolean;
    displayStyle: CMSelectDisplayStyle;

    size: CMChipSizeOptions;
    shape: CMChipShapeOptions;
    color: string | null;
};

interface ChipOptionMgrProps {
    value: ChipOptions;
    setValue: (value: ChipOptions) => void;
};

const ChipOptionMgr = (props: ChipOptionMgrProps) => {
    return <div>
        <ColorPick
            allowNull={true}
            onChange={x => props.setValue({ ...props.value, color: x?.id || null })}
            palettes={gGeneralPaletteList}
            value={props.value.color}
        />
        <CMSingleSelect<CMChipSizeOptions>
            value={props.value.size}
            onChange={(x) => props.setValue({ ...props.value, size: x })}
            {...StringArrayOptionsProvider<CMChipSizeOptions>(["small", "big"])}
        />
        <CMSingleSelect<CMChipShapeOptions>
            value={props.value.shape}
            onChange={(x) => props.setValue({ ...props.value, shape: x })}
            {...StringArrayOptionsProvider<CMChipShapeOptions>(["rectangle", "rounded"])}
        />
        <CMSingleSelect
            value={props.value.readonly ? "Readonly" : "Editable"}
            onChange={(x) => props.setValue({ ...props.value, readonly: x === "Readonly" })}
            {...StringArrayOptionsProvider(["Readonly", "Editable"])}
        />
        <CMSingleSelect<CMSelectDisplayStyle>
            value={props.value.displayStyle}
            onChange={(x) => props.setValue({ ...props.value, displayStyle: x })}
            {...StringArrayOptionsProvider<CMSelectDisplayStyle>([CMSelectDisplayStyle.SelectedWithDialog, CMSelectDisplayStyle.AllWithDialog, CMSelectDisplayStyle.AllWithInlineEditing])}
        />
    </div>
};

const MultiSelectTest = () => {
    const [selected, setSelected] = React.useState<number[]>([]);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });

    // if optionCount changes, or dataSet changes, make a new `options`
    const [optionCount, setOptionCount] = React.useState<number>(10);
    const [dataSet, setDataSet] = React.useState<Dataset>("numbers");
    const [options, setOptions] = React.useState<number[]>([1, 2, 4, 6, 8, 0]);

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Multi select</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMMultiSelect
                displayStyle={chipOptions.displayStyle}
                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                chipShape={chipOptions.shape}
                getOptions={(args) => [1, 2, 4, 6, 8, 0]}
                renderOption={opt => <>{opt}</>}
                value={selected}
                getOptionInfo={opt => ({
                    id: opt,
                    color: chipOptions.color,
                })}
                onChange={values => {
                    setSelected(values);
                }}
            />
        </div>
    </div >;
};

const SingleSelectTest = () => {
    const [selected, setSelected] = React.useState<number>(1);
    const [options, setOptions] = React.useState<number[]>([1, 2, 4, 6, 8, 0]);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single select</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMSingleSelect<number>
                displayStyle={chipOptions.displayStyle}
                readonly={chipOptions.readonly}
                chipShape={chipOptions.shape}
                chipSize={chipOptions.size}
                getOptions={(args) => [1, 2, 4, 6, 8, 0]}
                renderOption={opt => opt}
                getOptionInfo={opt => ({
                    id: opt,
                    color: chipOptions.color,
                })}
                value={selected}
                onChange={v => setSelected(v)}
            />
        </div>
    </div>;
};

const SingleSelectNullableTest = () => {
    const [selected, setSelected] = React.useState<number | null>(null);
    const [options, setOptions] = React.useState<(number | null)[]>([null, 1, 2, 4, 6, 8, 0]);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });


    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single select with null</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMSingleSelect<number>
                nullBehavior={CMSelectNullBehavior.AllowNull}
                displayStyle={chipOptions.displayStyle}
                readonly={chipOptions.readonly}
                chipShape={chipOptions.shape}
                chipSize={chipOptions.size}
                getOptions={(args) => [1, 2, 4, 6, 8, 0]}
                renderOption={opt => opt}
                getOptionInfo={opt => ({
                    id: opt,
                    color: chipOptions.color,
                })}
                value={selected}
                onChange={v => {
                    setSelected(v);
                    console.log(`set selectionto `);
                    console.log(v);
                }}
            />
        </div>
    </div>;
};

const getOptionsAsync = async (): Promise<number[]> => {
    await sleep(500);
    return [1, 2, 3, 4, 5, 6, 0, 10000];
};

const SingleSelectAsyncTest = () => {
    const [selected, setSelected] = React.useState<number>(1);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single select ASYNC (sleep)</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMSingleSelect<number>
                displayStyle={chipOptions.displayStyle}
                readonly={chipOptions.readonly}
                chipShape={chipOptions.shape}
                chipSize={chipOptions.size}
                getOptions={(args) => getOptionsAsync()}
                renderOption={opt => opt}
                getOptionInfo={opt => ({
                    id: opt,
                    color: chipOptions.color,
                })}
                value={selected}
                onChange={v => setSelected(v)}
            />
        </div>
    </div >;
};


const SelectSingleFetchTest = () => {
    type TypicodeUser = {
        id: number;
        name: string;
    };

    const fetchUsers = async (): Promise<TypicodeUser[]> => {
        const raw = await fetch('https://jsonplaceholder.typicode.com/users');
        await sleep(1000);
        return await raw.json();
    };

    const [selected, setSelected] = React.useState<TypicodeUser>();
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single user select (typicode) ASYNC</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMSingleSelect<TypicodeUser | undefined>
                displayStyle={chipOptions.displayStyle}
                readonly={chipOptions.readonly}
                chipShape={chipOptions.shape}
                chipSize={chipOptions.size}
                getOptions={(args) => fetchUsers()}
                renderOption={opt => <>{opt?.name || "<null>"}</>}

                getOptionInfo={opt => ({
                    id: opt?.id || -1,
                    color: chipOptions.color,
                })}
                value={selected}
                onChange={v => setSelected(v)}
            />
        </div>
    </div>;
};


const DB3SingleSelectTest = () => {
    const [selectedValue, setSelectedValue] = React.useState<db3.InstrumentPayloadMinimum | null>(null);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single instrument select DB3</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <DB3SingleSelect<db3.InstrumentPayloadMinimum>
                value={selectedValue}
                nullBehavior={CMSelectNullBehavior.AllowNull}
                displayStyle={chipOptions.displayStyle}
                onChange={v => setSelectedValue(v)}
                renderOption={value => !value ? "<none>" : <>{value.name}</>}
                schema={db3.xInstrument}

                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                chipShape={chipOptions.shape}
            />
        </div>
    </div >;
};


const DB3MultiSelectTest = () => {
    const [selectedValue, setSelectedValue] = React.useState<db3.InstrumentPayloadMinimum[]>([]);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Multiple instrument select DB3</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <DB3MultiSelect<db3.InstrumentPayloadMinimum>
                value={selectedValue}
                displayStyle={chipOptions.displayStyle}
                onChange={v => setSelectedValue(v)}
                renderOption={value => <>{value.name}</>}
                schema={db3.xInstrument}

                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                chipShape={chipOptions.shape}
            />
        </div>
    </div >;
};


const DB3MultiSelectTestWithNew = () => {
    const [selectedValue, setSelectedValue] = React.useState<db3.InstrumentTagPayload[]>([]);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Multiple instrument select DB3 + add new support</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <DB3MultiSelect<db3.InstrumentTagPayload>
                value={selectedValue}
                displayStyle={chipOptions.displayStyle}
                onChange={v => setSelectedValue(v)}
                renderOption={value => <>{value.text}</>}
                schema={db3.xInstrumentTag}

                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                chipShape={chipOptions.shape}
                allowInsertFromString={true}
            />
        </div>
    </div >;
};


const DB3SingleSelectTestWithAddNew = () => {
    const [selectedValue, setSelectedValue] = React.useState<db3.InstrumentFunctionalGroupPayloadMinimum | null>(null);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        displayStyle: CMSelectDisplayStyle.AllWithDialog,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0", maxWidth: "600px" }}>
        <h3>Single instrument select DB3, insert support</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white" }}>
            <DB3SingleSelect<db3.InstrumentFunctionalGroupPayloadMinimum>
                value={selectedValue}
                nullBehavior={CMSelectNullBehavior.AllowNull}
                onChange={v => setSelectedValue(v)}
                renderOption={value => !value ? "<none>" : <>{value.name}</>}
                schema={db3.xInstrumentFunctionalGroup}
                displayStyle={chipOptions.displayStyle}

                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                chipShape={chipOptions.shape}

                allowInsertFromString={true}
                allowQuickFilter={true}
            />
        </div>
    </div >;
};




const MinimalUserSelect = () => {
    const [selectedValue, setSelectedValue] = React.useState<db3.UserPayloadMinimum | null>(null);
    return <div style={{ border: "2px solid blue", margin: "10px 0", maxWidth: "600px" }}>
        <h3>Minimal user selection</h3>
        <div style={{ padding: "20px", backgroundColor: "white" }}>
            <DB3SingleSelect<db3.UserPayloadMinimum>
                value={selectedValue}
                schema={db3.xUser}
                nullBehavior={CMSelectNullBehavior.AllowNull}
                onChange={v => setSelectedValue(v)}
            />
        </div>
    </div >;
};


const CMSelectTestPage: BlitzPage = () => {
    return (
        <DashboardLayout title="theme editor">

            <SingleSelectTest />
            <SingleSelectNullableTest />
            <SelectSingleFetchTest />
            <SingleSelectAsyncTest />
            <MultiSelectTest />

            <DB3SingleSelectTest />
            <DB3SingleSelectTestWithAddNew />
            <DB3MultiSelectTest />
            <DB3MultiSelectTestWithNew />

            <MinimalUserSelect />
        </DashboardLayout>
    )
}

export default CMSelectTestPage;

