import {
    InputBase,
    TextField
} from "@mui/material";
import React from "react";
import {
    Search as SearchIcon
} from '@mui/icons-material';
import CancelIcon from '@mui/icons-material/Cancel';
import { assert } from "blitz";
import { formatSongLength, parseSongLengthSeconds } from "shared/time";
import { CoerceToNumberOrNull, parseFloatOrNull } from "shared/utils";




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMTextInputBaseProps {
    value?: string | null;
    initialValue?: string | null;
    onChange: (e, value: string) => void;
    autoFocus?: boolean;
    readOnly?: boolean;
    className?: string;
    type?: "password" | "text"; // "password" | "text" etc.
    ref?: React.Ref<HTMLInputElement>;
    style?: React.CSSProperties | undefined;
    placeholder?: string;
};

// textfield for a string field on an object.
export function CMTextInputBase({ value, onChange, autoFocus, readOnly, ...props }: CMTextInputBaseProps) {
    const [controlledValue, setControlledValue] = React.useState<string>(props.initialValue || "");
    // if you specify initial value, then we keep the live value internally.
    const weControlValue = props.initialValue !== undefined;
    assert(!props.initialValue || !value, "specifying both initial & value is nonsense. either controlled or uncontrolled but not both.");

    const useValue = (weControlValue ? controlledValue : value) || "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (weControlValue) {
            setControlledValue(val);
        }
        onChange(e, val);
    };

    return <input
        ref={props.ref}
        placeholder={props.placeholder}
        type={props.type || "text"}
        disabled={!!readOnly}
        autoFocus={!!autoFocus}
        onChange={handleChange}
        value={useValue}
        className={`CMTextInputBase ${props.className}`}
        autoComplete="off"
        data-lpignore="true"
        style={props.style}
    />;
};





// validation should probably NOT be done per-field.
// but rather, validation done as Zod is designed at the object level, then error object is passed down into fields

// callers controls the value
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface CMTextFieldProps {
    validationError?: string | null;
    label?: string;
    value: string | null;
    onChange: (e, value) => void;
    autoFocus: boolean;
    readOnly?: boolean;
    className?: string;
    style?: React.CSSProperties;
    multiline?: boolean | undefined;
};

// textfield for a string field on an object.
export function CMTextField({ validationError, label, value, onChange, autoFocus, readOnly, ...props }: CMTextFieldProps) {
    return (
        <TextField
            //key={key}
            disabled={!!readOnly}
            autoFocus={autoFocus}
            label={label}
            error={!!validationError}
            helperText={validationError}
            onChange={(e) => { onChange(e, e.target.value); }}
            value={value || ""}
            margin="dense"
            type="text"
            fullWidth
            style={props.style}
            className={props.className}
            variant="filled"
            multiline={props.multiline}
            inputProps={{
                'data-lpignore': true, // supposedly prevent lastpass from auto-completing. doesn't work for me tho
            }}
        />
    );
};

interface CMNumericTextFieldProps {
    validationError?: string | null;
    label?: string;
    value: number;
    onChange: (e, value: number) => void;
    autoFocus: boolean;
    readOnly?: boolean;
    className?: string;
    style?: React.CSSProperties;
};

// textfield for a string field on an object.
export function CMNumericTextField({ label, value, autoFocus, readOnly, ...props }: CMNumericTextFieldProps) {
    const [stringValue, setStringValue] = React.useState<string>(value.toString());
    const [validationError, setValidationError] = React.useState<string | undefined>();
    React.useEffect(() => {
        const x = parseFloatOrNull(stringValue);
        if (typeof x === 'number') {
            setValidationError(undefined);
            return;
        }
        setValidationError(`Input must be numeric`);
    }, [stringValue]);

    React.useEffect(() => {
        setStringValue(value.toString());
    }, [value]);

    return (
        <TextField
            disabled={!!readOnly}
            autoFocus={autoFocus}
            label={label}
            error={!!validationError}
            helperText={validationError}
            onChange={(e) => {
                setStringValue(e.target.value);
                const x = parseFloatOrNull(e.target.value);
                if (typeof x === 'number') {
                    props.onChange(e, x);
                }
            }}
            value={stringValue}
            margin="dense"
            type="text"
            fullWidth
            style={props.style}
            className={props.className}
            variant="filled"
            inputProps={{
                'data-lpignore': true, // supposedly prevent lastpass from auto-completing. doesn't work for me tho
            }}
        />
    );
};




// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface EditableTextControlProps {
//     initialValue: string | null, // value which may be coming from the database.
//     onValueChanged: (val: string | null) => void, // caller can save the changed value to a db here.
//     isSaving: boolean, // show the value as saving in progress
//     debounceMilliseconds: number,
// }

// export const DebouncedTextField = (props: EditableTextControlProps) => {

//     const render = (args: DebouncedControlCustomRenderArgs) => {
//         return <div style={{ display: "flex" }}>
//             <CMTextField
//                 value={args.value}
//                 onChange={(e, value) => args.onChange(value)}
//                 autoFocus={false}
//                 //label="todo: label here"
//                 validationError={null}
//                 readOnly={false}
//             />
//             {args.isSaving ? (<><CircularProgress color="info" size="1rem" /> Saving ...</>) : (
//                 args.isDebouncing ? (<><CircularProgress color="warning" size="1rem" /></>) : (
//                     <></>
//                 )
//             )}

//         </div>;
//     };

//     return <DebouncedControlCustomRender
//         render={render}
//         debounceMilliseconds={props.debounceMilliseconds}
//         initialValue={props.initialValue}
//         isSaving={props.isSaving}
//         onValueChanged={props.onValueChanged}
//     />;
// };





////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// must be uncontrolled because of the debouncing. if caller sets the value, then debounce is not possible.
// miraculously works with useQuery as initial value. i don't understand how tbh.
// interface EditableTextControlProps {
//     initialValue: string | null, // value which may be coming from the database.
//     onValueChanged: (val: string | null) => void, // caller can save the changed value to a db here.
//     isSaving: boolean, // show the value as saving in progress
//     debounceMilliseconds: number,
// }

// export function EditableTextControl(props: EditableTextControlProps) {

//     const realEdit = (value, onChange) => <div className='valueContainer'>
//         <CMTextField
//             value={value}
//             onChange={(e, value) => onChange(value)}
//             autoFocus={false}
//             label="todo: label here"
//             validationError={null}
//             readOnly={false}
//         />
//         <FormHelperText id="my-helper-text">We'll never share your email.</FormHelperText>
//     </div>;

//     const viewMode = (value) => <div className='valueContainer'>
//         <div className="value">{value}</div>
//         <FormHelperText id="my-helper-text">We'll never share your email.</FormHelperText>
//     </div>;

//     return <DebouncedControl
//         debounceMilliseconds={props.debounceMilliseconds}
//         initialValue={props.initialValue}
//         isSaving={props.isSaving}
//         onValueChanged={props.onValueChanged}
//         className="EditableTextControl"
//         render={(showingEditor, value, onChange) => {
//             return showingEditor ? realEdit(value, onchange) :
//                 viewMode(value);
//         }}
//     />;
// };



// export function EditableTextControl(props: EditableTextControlProps) {

//     const [editMode, setEditMode] = React.useState(false);

//     const view = <div style={{ display: "flex" }}>
//         <Button startIcon={RenderMuiIcon("Edit")} onClick={() => setEditMode(true)}></Button>
//         <div>{props.initialValue}</div>
//     </div>;

//     const edit = <div style={{ display: "flex" }}>
//         <Button startIcon={RenderMuiIcon("Done")} onClick={() => setEditMode(false)}></Button>
//         <DebouncedTextField
//             debounceMilliseconds={props.debounceMilliseconds}
//             initialValue={props.initialValue}
//             isSaving={props.isSaving}
//             onValueChanged={props.onValueChanged}
//         />
//     </div>;

//     return editMode ? edit : view;
// };



// ////////////////k////////////////////////////////////////////////////////////////////////////////////////////////
// interface MutationTextControlProps {
//     initialValue: string | null,
//     refetch: () => void,
//     onChange: (value: string | null) => Promise<any>,
//     successMessage?: string,
//     errorMessage?: string,
//     debounceMilliseconds?: number,
// };

// export const MutationTextControl = (props: MutationTextControlProps) => {
//     const [isSaving, setIsSaving] = React.useState(false);
//     const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

//     const onValueChanged = (newValue: string | null) => {
//         setIsSaving(true);
//         props.onChange(newValue).then(x => {
//             showSnackbar({ severity: "success", children: props.successMessage || "Updated" });
//         }).catch(e => {
//             console.log(e);
//             showSnackbar({ severity: "error", children: props.errorMessage || "Error" });
//         }).finally(() => {
//             setIsSaving(false);
//             props.refetch();
//         });
//     };

//     return <EditableTextControl
//         initialValue={props.initialValue || ""}
//         isSaving={isSaving}
//         onValueChanged={onValueChanged}
//         debounceMilliseconds={props.debounceMilliseconds || 1200}
//     />;
// };




// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// export interface ButtonSelectOption {
//     value: any,
//     label: string,
//     iconName?: TIconOptions,
//     color: string | null,
// };
// export interface ButtonSelectControlProps {
//     options: ButtonSelectOption[],
//     initialValue: any, // value which may be coming from the database.
//     onValueChanged: (val: any) => void, // caller can save the changed value to a db here.
//     isSaving: boolean, // show the value as saving in progress
// }

// export function ButtonSelectControl(props: ButtonSelectControlProps) {
//     return <DebouncedControl
//         initialValue={props.initialValue}
//         debounceMilliseconds={600} // faster debounce for button select because you don't hit it so much to warrant debounce
//         isSaving={props.isSaving}
//         onValueChanged={props.onValueChanged}
//         className="ButtonArrayControl"
//         render={(showingEditor, value, onChange) => {
//             const selectedOption = props.options.find(o => o.value === value)!;

//             const selectedStyle = GetStyleVariablesForColor({ color: selectedOption.color, ...StandardVariationSpec.Strong });

//             return <div className='valueContainer'>
//                 {showingEditor ? <ButtonGroup>
//                     {props.options.map((option, i) => {
//                         const style = GetStyleVariablesForColor({ color: option.color, ...StandardVariationSpec.Strong });
//                         return <Button
//                             key={i}
//                             style={style.style}
//                             className={`applyColor ${style.cssClass} ${option.value === value ? "selected" : "notSelected"}`}
//                             startIcon={RenderMuiIcon(option.iconName)}
//                             onClick={() => { onChange(option.value) }}>
//                             {option.label}
//                         </Button>;
//                     })}
//                 </ButtonGroup>
//                     :
//                     <div className="value applyColor  ${style.cssClass}" style={selectedStyle.style}>{selectedOption.label}</div>}
//             </div>

//         }}
//     />;
// }



// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface MutationButtonSelectControlProps {
//     options: ButtonSelectOption[],
//     initialValue: any,
//     refetch: () => void,
//     onChange: (value: any) => Promise<any>,
// };

// export const MutationButtonSelectControl = (props: MutationButtonSelectControlProps) => {
//     const [isSaving, setIsSaving] = React.useState(false);
//     const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

//     const onValueChanged = (newValue: string | null) => {
//         setIsSaving(true);
//         props.onChange(newValue).then(x => {
//             showSnackbar({ severity: "success", children: "Updated" });
//         }).catch(e => {
//             console.log(e);
//             showSnackbar({ severity: "error", children: "Error" });
//         }).finally(() => {
//             setIsSaving(false);
//             props.refetch();
//         });
//     };

//     return <ButtonSelectControl
//         options={props.options}
//         initialValue={props.initialValue}
//         isSaving={isSaving}
//         onValueChanged={onValueChanged}
//     />;
// };



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SongLengthInputProps {
    initialValue: string | number | null;
    onChange: (value: number | null) => void;
    readonly?: boolean;
    inputStyle?: React.CSSProperties | undefined;
};
export const SongLengthInput = (props: SongLengthInputProps) => {
    const [controlledValue, setControlledValue] = React.useState<string>(() => {
        const seconds = CoerceToNumberOrNull(props.initialValue);
        if (seconds === null) return "";
        return formatSongLength(seconds) || "";
    });

    // round trip to give a preview.
    const lengthSeconds = parseSongLengthSeconds(controlledValue);
    const previewLength = lengthSeconds === null ? "" : formatSongLength(lengthSeconds);

    React.useEffect(() => {
        props.onChange(lengthSeconds);
    }, [lengthSeconds]);

    return <div className="songLengthInputContainer">
        <CMTextInputBase value={controlledValue} onChange={(e, v) => { setControlledValue(v); }} style={props.inputStyle} />
        <div className="preview">{previewLength}</div>
    </div>
        ;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SearchInputProps {
    value: string;
    onChange: (v) => void;
    autoFocus?: boolean;
};

export const SearchInput = (props: SearchInputProps) => {
    return <InputBase
        autoFocus={props.autoFocus}
        size="small"
        placeholder="Search"
        sx={{
            backgroundColor: "#f0f0f0",
            borderRadius: 3,
        }}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        startAdornment={<SearchIcon className="HalfOpacity" />}
        endAdornment={<div className="freeButton HalfOpacity" onClick={() => props.onChange("")}><CancelIcon /></div>}
    />;
}