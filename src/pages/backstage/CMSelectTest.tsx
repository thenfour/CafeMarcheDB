import { BlitzPage } from "@blitzjs/next";
import React from "react";
import { gGeneralPaletteList, gSwatchColors } from "shared/color";
import { sleep } from "shared/utils";
import { CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { CMMultiSelect, CMSelectEditStyle, CMSelectValueDisplayStyle, CMSingleSelect, StringArrayOptionsProvider } from "src/core/components/CMSelect";
import { ColorPick } from "src/core/components/Color";
import { DB3MultiSelect, DB3SingleSelect } from "src/core/db3/components/db3Select";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

type Dataset = "numbers";

interface ChipOptions {
    readonly: boolean;
    editStyle: CMSelectEditStyle;
    valueDisplayStyle: CMSelectValueDisplayStyle;

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
        <CMSingleSelect<CMSelectEditStyle>
            value={props.value.editStyle}
            onChange={(x) => props.setValue({ ...props.value, editStyle: x })}
            {...StringArrayOptionsProvider<CMSelectEditStyle>([CMSelectEditStyle.dialog, CMSelectEditStyle.inlineWithDialog])}
        />
        <CMSingleSelect<CMSelectValueDisplayStyle>
            value={props.value.valueDisplayStyle}
            onChange={(x) => props.setValue({ ...props.value, valueDisplayStyle: x })}
            {...StringArrayOptionsProvider([CMSelectValueDisplayStyle.all, CMSelectValueDisplayStyle.selected])}
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
        editStyle: CMSelectEditStyle.inlineWithDialog,
        valueDisplayStyle: CMSelectValueDisplayStyle.all,
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
                valueDisplayStyle={chipOptions.valueDisplayStyle}
                editStyle={chipOptions.editStyle}
                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                chipShape={chipOptions.shape}
                getOptions={(args) => [1, 2, 4, 6, 8, 0]}
                renderOption={opt => <>{opt}</>}
                value={selected}
                getOptionById={opt => options.find(x => x === opt)!}
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
        editStyle: CMSelectEditStyle.inlineWithDialog,
        valueDisplayStyle: CMSelectValueDisplayStyle.all,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single select</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMSingleSelect<number>
                valueDisplayStyle={chipOptions.valueDisplayStyle}
                editStyle={chipOptions.editStyle}
                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                getOptions={(args) => [1, 2, 4, 6, 8, 0]}
                renderOption={opt => <>{opt}</>}
                getOptionById={opt => options.find(x => x === opt)!}
                getOptionInfo={opt => ({
                    id: opt,
                    color: gSwatchColors.blue,
                })}
                value={selected}
                onChange={v => setSelected(v)}
            />
        </div>
    </div>;
};

const SingleSelectNullableTest = () => {
    const [selected, setSelected] = React.useState<number | undefined>();
    const [options, setOptions] = React.useState<(number | undefined)[]>([undefined, 1, 2, 4, 6, 8, 0]);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        editStyle: CMSelectEditStyle.inlineWithDialog,
        valueDisplayStyle: CMSelectValueDisplayStyle.all,
    });


    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single select with null</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMSingleSelect<number | undefined>
                valueDisplayStyle={chipOptions.valueDisplayStyle}
                editStyle={chipOptions.editStyle}
                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                getOptions={(args) => [1, 2, 4, 6, 8, 0]}
                renderOption={opt => <>{opt || "<null>"}</>}
                getOptionById={opt => options.find(x => x === opt)!}
                getOptionInfo={opt => ({
                    id: opt || -1,
                    color: gSwatchColors.blue,
                })}
                value={selected}
                onChange={v => setSelected(v)}
            />
        </div>
    </div>;
};

const getOptionsAsync = async (): Promise<number[]> => {
    await sleep(500);
    return [1, 2, 3, 4, 5, 6, 0, 10000];
};

const getOptionByIdAsync = async (id: number): Promise<number> => {
    await sleep(500);
    return id;
};

const SingleSelectAsyncTest = () => {
    const [selected, setSelected] = React.useState<number>(1);
    const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
        color: null,
        size: "big",
        shape: "rectangle",
        readonly: false,
        editStyle: CMSelectEditStyle.inlineWithDialog,
        valueDisplayStyle: CMSelectValueDisplayStyle.all,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single select ASYNC</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMSingleSelect<number>
                valueDisplayStyle={chipOptions.valueDisplayStyle}
                editStyle={chipOptions.editStyle}
                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                getOptions={(args) => getOptionsAsync()}
                renderOption={opt => <>{opt || "<null>"}</>}
                getOptionById={getOptionByIdAsync}// opt => options.find(x => x === opt)!}
                getOptionInfo={opt => ({
                    id: opt || -1,
                    color: gSwatchColors.blue,
                })}
                value={selected}
                onChange={v => setSelected(v)}
            />
        </div>
    </div>;
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
        editStyle: CMSelectEditStyle.inlineWithDialog,
        valueDisplayStyle: CMSelectValueDisplayStyle.all,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single user select ASYNC</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <CMSingleSelect<TypicodeUser | undefined>
                valueDisplayStyle={chipOptions.valueDisplayStyle}
                editStyle={chipOptions.editStyle}
                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
                getOptions={(args) => fetchUsers()}
                renderOption={opt => <>{opt?.name || "<null>"}</>}
                getOptionById={(id) => fetchUsers().then(users => users.find(user => user.id === id))}

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
        editStyle: CMSelectEditStyle.inlineWithDialog,
        valueDisplayStyle: CMSelectValueDisplayStyle.all,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Single instrument select DB3</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <DB3SingleSelect<db3.InstrumentPayloadMinimum | null>
                value={selectedValue}
                onChange={v => setSelectedValue(v)}
                renderOption={value => !value ? "<none>" : <>{value.name}</>}
                schema={db3.xInstrument}

                valueDisplayStyle={chipOptions.valueDisplayStyle}
                editStyle={chipOptions.editStyle}
                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
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
        editStyle: CMSelectEditStyle.inlineWithDialog,
        valueDisplayStyle: CMSelectValueDisplayStyle.all,
    });

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <h3>Multiple instrument select DB3</h3>
        <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
        <div style={{ padding: "20px", backgroundColor: "white", maxWidth: "600px" }}>
            <DB3MultiSelect<db3.InstrumentPayloadMinimum>
                value={selectedValue}
                onChange={v => setSelectedValue(v)}
                renderOption={value => <>{value.name}</>}
                schema={db3.xInstrument}

                valueDisplayStyle={chipOptions.valueDisplayStyle}
                editStyle={chipOptions.editStyle}
                readonly={chipOptions.readonly}
                chipSize={chipOptions.size}
            />
        </div>
    </div >;
};



const CMSelectTestPage: BlitzPage = () => {
    return (
        <DashboardLayout title="theme editor">

            <DB3SingleSelectTest />
            <DB3MultiSelectTest />

            <SelectSingleFetchTest />

            <MultiSelectTest />
            <SingleSelectTest />

            <SingleSelectNullableTest />

            <SingleSelectAsyncTest />
        </DashboardLayout>
    )
}

export default CMSelectTestPage;

