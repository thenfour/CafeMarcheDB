import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React, { Suspense } from "react";
import { gSwatchColors } from "shared/color";
import { CMMultiSelect, CMSingleSelect } from "src/core/components/CMSelect";
import { KeyValueDisplay } from "src/core/components/CMCoreComponents2";
import { CMChipSizeOptions } from "src/core/components/CMCoreComponents";
import { CMSingleSelectDialog } from "src/core/components/CMSingleSelectDialog";

//

const MultiSelectTest = () => {
    const [chipSize, setChipSize] = React.useState<CMChipSizeOptions>("big");
    const [readonly, setReadonly] = React.useState<boolean>(false);
    const [selected, setSelected] = React.useState<number[]>([]);
    const [options, setOptions] = React.useState<number[]>([1, 2, 4, 6, 8, 0]);
    const [valueStyle, setValueStyle] = React.useState<"all" | "selected">("all");
    const [editStyle, setEditStyle] = React.useState<"dialog" | "inline+dialog">("dialog");

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <div>
            <button onClick={e => setChipSize("small")}>Small</button>
            <button onClick={e => setChipSize("big")}>Big</button>
        </div>
        <div>
            <button onClick={e => setReadonly(true)}>Readonly</button>
            <button onClick={e => setReadonly(false)}>Editable</button>
        </div>
        <div>
            <button onClick={e => setValueStyle("all")}>Value style ALL</button>
            <button onClick={e => setValueStyle("selected")}>Value style SELECTED</button>
        </div>
        <div>
            <button onClick={e => setEditStyle("dialog")}>edit style DIALOG</button>
            <button onClick={e => setEditStyle("inline+dialog")}>Value style INLINE DIALOG</button>
        </div>
        <KeyValueDisplay data={{
            chipSize,
            readonly,
            valueStyle,
            editStyle,
        }} />
        <CMMultiSelect
            valueDisplayStyle={valueStyle}
            editStyle={editStyle}
            readonly={readonly}
            chipSize={chipSize}
            getOptions={(args) => [1, 2, 4, 6, 8, 0]}
            renderOption={opt => <>{opt}</>}
            value={selected}
            getOptionById={opt => options.find(x => x === opt)!}
            getOptionInfo={opt => ({
                id: opt,
                color: gSwatchColors.blue,
            })}
            onChange={values => {
                setSelected(values);
            }}
        />
    </div>;
};

const SingleSelectTest = () => {
    const [chipSize, setChipSize] = React.useState<CMChipSizeOptions>("big");
    const [readonly, setReadonly] = React.useState<boolean>(false);
    const [selected, setSelected] = React.useState<number>(1);
    const [options, setOptions] = React.useState<number[]>([1, 2, 4, 6, 8, 0]);
    const [valueStyle, setValueStyle] = React.useState<"all" | "selected">("all");
    const [editStyle, setEditStyle] = React.useState<"dialog" | "inline+dialog">("dialog");

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <div>
            <button onClick={e => setChipSize("small")}>Small</button>
            <button onClick={e => setChipSize("big")}>Big</button>
        </div>
        <div>
            <button onClick={e => setReadonly(true)}>Readonly</button>
            <button onClick={e => setReadonly(false)}>Editable</button>
        </div>
        <div>
            <button onClick={e => setValueStyle("all")}>Value style ALL</button>
            <button onClick={e => setValueStyle("selected")}>Value style SELECTED</button>
        </div>
        <div>
            <button onClick={e => setEditStyle("dialog")}>edit style DIALOG</button>
            <button onClick={e => setEditStyle("inline+dialog")}>Value style INLINE DIALOG</button>
        </div>
        <KeyValueDisplay data={{
            chipSize,
            readonly,
            valueStyle,
            editStyle,
        }} />
        <CMSingleSelect<number>
            valueDisplayStyle={valueStyle}
            editStyle={editStyle}
            readonly={readonly}
            chipSize={chipSize}
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
    </div>;
};

const SingleSelectNullableTest = () => {
    const [chipSize, setChipSize] = React.useState<CMChipSizeOptions>("big");
    const [readonly, setReadonly] = React.useState<boolean>(false);
    const [selected, setSelected] = React.useState<number | undefined>();
    const [options, setOptions] = React.useState<(number | undefined)[]>([undefined, 1, 2, 4, 6, 8, 0]);
    const [valueStyle, setValueStyle] = React.useState<"all" | "selected">("all");
    const [editStyle, setEditStyle] = React.useState<"dialog" | "inline+dialog">("dialog");

    return <div style={{ border: "2px solid blue", margin: "10px 0" }}>
        <div>
            <button onClick={e => setChipSize("small")}>Small</button>
            <button onClick={e => setChipSize("big")}>Big</button>
        </div>
        <div>
            <button onClick={e => setReadonly(true)}>Readonly</button>
            <button onClick={e => setReadonly(false)}>Editable</button>
        </div>
        <div>
            <button onClick={e => setValueStyle("all")}>Value style ALL</button>
            <button onClick={e => setValueStyle("selected")}>Value style SELECTED</button>
        </div>
        <div>
            <button onClick={e => setEditStyle("dialog")}>edit style DIALOG</button>
            <button onClick={e => setEditStyle("inline+dialog")}>Value style INLINE DIALOG</button>
        </div>
        <KeyValueDisplay data={{
            chipSize,
            readonly,
            valueStyle,
            editStyle,
        }} />
        <CMSingleSelect<number | undefined>
            valueDisplayStyle={valueStyle}
            editStyle={editStyle}
            readonly={readonly}
            chipSize={chipSize}
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
    </div>;
};

const CMSelectTestPage: BlitzPage = () => {
    return (
        <DashboardLayout title="theme editor">
            <MultiSelectTest />
            <SingleSelectTest />
            <SingleSelectNullableTest />
        </DashboardLayout>
    )
}

export default CMSelectTestPage;

