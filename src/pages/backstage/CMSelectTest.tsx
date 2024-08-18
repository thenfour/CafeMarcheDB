import { useAuthenticatedSession, useSession } from "@blitzjs/auth";
import { BlitzPage } from "@blitzjs/next";
import React from "react";
import { gGeneralPaletteList, gSwatchColors } from "shared/color";
import { sleep } from "shared/utils";
import { CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMCoreComponents";
import { CMMultiSelect, CMSelectEditStyle, CMSelectValueDisplayStyle, CMSingleSelect, StringArrayOptionsProvider } from "src/core/components/CMSelect";
import { ColorPick } from "src/core/components/Color";
import { useDashboardContext } from "src/core/components/DashboardContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import db3queries from "src/core/db3/queries/db3queries";
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
        <div style={{ padding: "20px", backgroundColor: "white" }}>
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
        <div style={{ padding: "20px", backgroundColor: "white" }}>
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
        <div style={{ padding: "20px", backgroundColor: "white" }}>
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
        <div style={{ padding: "20px", backgroundColor: "white" }}>
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
        <div style={{ padding: "20px", backgroundColor: "white" }}>
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



// const SelectSingleDb3UsersTest = () => {
//     const ctx = useDashboardContext();
//     type User = db3.UserMinimumPayload;

//     const fetchArgs: DB3Client.FetchAsyncArgs<User> = {
//         clientIntention: ctx.userClientIntention,
//         schema: db3.xUser,
//         take: 20,
//         delayMS: 500,
//     };
//     const [getOptionsPromise, getOptionsStatus] = DB3Client.useFetchAsync<User>(fetchArgs);

//     const [selected, setSelected] = React.useState<User>();
//     const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
//         color: null,
//         size: "big",
//         shape: "rectangle",
//         readonly: false,
//         editStyle: CMSelectEditStyle.inlineWithDialog,
//         valueDisplayStyle: CMSelectValueDisplayStyle.all,
//     });

//     return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
//         <h3>Single user select ASYNC</h3>
//         {getOptionsStatus.queryResult && <button onClick={() => getOptionsStatus.queryResult?.refetch()}>refetch</button>}
//         <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
//         <div style={{ padding: "20px", backgroundColor: "white" }}>
//             <CMSingleSelect<User | undefined>
//                 valueDisplayStyle={chipOptions.valueDisplayStyle}
//                 editStyle={chipOptions.editStyle}
//                 readonly={chipOptions.readonly}
//                 chipSize={chipOptions.size}
//                 getOptions={args => getOptionsPromise().then(x => x.items)}
//                 renderOption={opt => <>{opt?.name || "<null>"}</>}
//                 getOptionById={(id) => DB3Client.useFetchAsync<User>(fetchArgs)[0]().then(x => x.items.find(user => user.id === id))}

//                 getOptionInfo={opt => ({
//                     id: opt?.id || -1,
//                     color: chipOptions.color,
//                 })}
//                 value={selected}
//                 onChange={v => setSelected(v)}
//             />
//         </div>
//     </div>;
// };


// so the problem here is about the use of useQuery(), and the arguments passed to them.
// but actually it MUST be a useQuery() hook in order to take advantage of caching and all the RPC magic that blitz provides.
// so basically, the Promise<X[]> options feature doesn't really give us db3 compatibility yet.
// db3 cannot be adapted to a Promise<> because it requires a hook.



// const MultiSingleDb3InstrumentsTest = () => {
//     const ctx = useDashboardContext();
//     type T = db3.InstrumentFunctionalGroupPayloadMinimum;

//     const fetchArgs: DB3Client.FetchAsyncArgs<T> = {
//         clientIntention: ctx.userClientIntention,
//         schema: db3.xInstrumentFunctionalGroup,
//         delayMS: 500,
//         filterModel: {
//             items: [],
//             tableParams: {
//                 nothing: Date.now(),
//             }
//         }
//     };
//     //const [getOptionsPromise, getOptionsStatus] = DB3Client.useFetchAsync<T>(fetchArgs);

//     const [selected, setSelected] = React.useState<T[]>([]);
//     const [chipOptions, setChipOptions] = React.useState<ChipOptions>({
//         color: null,
//         size: "big",
//         shape: "rectangle",
//         readonly: false,
//         editStyle: CMSelectEditStyle.inlineWithDialog,
//         valueDisplayStyle: CMSelectValueDisplayStyle.all,
//     });

//     // so we must get our <*Select> components to use useQuery().

//     // // Function to fetch users using the Blitz query directly
//     // const fetchUsers = (): Promise<User[]> => {
//     //     return db3queries(, {});
//     // };

//     return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
//         <h3>Single Functional group select ASYNC</h3>
//         {/* {getOptionsStatus.queryResult && <button onClick={() => getOptionsStatus.queryResult?.refetch()}>refetch</button>} */}
//         <ChipOptionMgr value={chipOptions} setValue={x => setChipOptions(x)} />
//         <div style={{ padding: "20px", backgroundColor: "white" }}>
//             <CMMultiSelect<T>
//                 valueDisplayStyle={chipOptions.valueDisplayStyle}
//                 editStyle={chipOptions.editStyle}
//                 readonly={chipOptions.readonly}
//                 chipSize={chipOptions.size}
//                 getOptions={args => DB3Client.useFetchAsync<T>(fetchArgs)[0]().then(x => x.items)}
//                 renderOption={opt => <>{!opt ? "<none>" : opt.name}</>}
//                 getOptionById={(id) => DB3Client.useFetchAsync<T>(fetchArgs)[0]().then(x => x.items.find(user => user.id === id)!)}

//                 getOptionInfo={opt => ({
//                     id: opt?.id || -1,
//                     color: opt.color,
//                 })}
//                 value={selected}
//                 onChange={v => setSelected(v)}
//             />
//         </div>
//     </div>;
// };




const CMSelectTestPage: BlitzPage = () => {
    return (
        <DashboardLayout title="theme editor">
            <SelectSingleFetchTest />
            {/* <SelectSingleDb3UsersTest /> */}
            {/* <MultiSingleDb3InstrumentsTest /> */}

            <MultiSelectTest />
            <SingleSelectTest />
            <SingleSelectNullableTest />
            <SingleSelectAsyncTest />
        </DashboardLayout>
    )
}

export default CMSelectTestPage;

