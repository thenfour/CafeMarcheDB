import React from "react";
import {
    Button,
    ButtonGroup,
    CircularProgress,
    TextField
} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
//import { useDebounce } from "shared/useDebounce";
import { DebouncedControl } from "./RichTextEditor";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { TAnyModel, TIconOptions } from "shared/utils";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconSelectDialog";
import { GetStyleVariablesForColor } from "./Color";

// validation should probably NOT be done per-field.
// but rather, validation done as Zod is designed at the object level, then error object is passed down into fields

// callers controls the value

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface CMTextFieldProps {
    validationError: string | null;
    label: string;
    value: string | null;
    onChange: (e, value) => void;
    autoFocus: boolean;
    readOnly?: boolean;
};

// textfield for a string field on an object.
export function CMTextField({ validationError, label, value, onChange, autoFocus, readOnly }: CMTextFieldProps) {
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
            variant="filled"
            inputProps={{
                'data-lpignore': true, // supposedly prevent lastpass from auto-completing. doesn't work for me tho
            }}
        />
    );
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// must be uncontrolled because of the debouncing. if caller sets the value, then debounce is not possible.
// miraculously works with useQuery() as initial value. i don't understand how tbh.
interface EditableTextControlProps {
    initialValue: string | null, // value which may be coming from the database.
    onValueChanged: (val: string | null) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
    debounceMilliseconds: number,
}

export function EditableTextControl(props: EditableTextControlProps) {
    return <DebouncedControl
        debounceMilliseconds={props.debounceMilliseconds}
        initialValue={props.initialValue}
        isSaving={props.isSaving}
        onValueChanged={props.onValueChanged}
        className="EditableTextControl"
        render={(showingEditor, value, onChange) => {
            return <div className='valueContainer'>
                {showingEditor ? <CMTextField
                    value={value}
                    onChange={(e, value) => onChange(value)}
                    autoFocus={false}
                    label="todo: label here"
                    validationError={null}
                    readOnly={false}
                /> :
                    <div className="value">{value}</div>}
            </div>

        }}
    />;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MutationTextControlProps {
    initialValue: string | null,
    refetch: () => void,
    onChange: (value: string | null) => Promise<any>,
    successMessage?: string,
    errorMessage?: string,
    debounceMilliseconds?: number,
};

export const MutationTextControl = (props: MutationTextControlProps) => {
    const [isSaving, setIsSaving] = React.useState(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onValueChanged = (newValue: string | null) => {
        setIsSaving(true);
        props.onChange(newValue).then(x => {
            showSnackbar({ severity: "success", children: props.successMessage || "Updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: props.errorMessage || "Error" });
        }).finally(() => {
            setIsSaving(false);
            props.refetch();
        });
    };

    return <EditableTextControl
        initialValue={props.initialValue || ""}
        isSaving={isSaving}
        onValueChanged={onValueChanged}
        debounceMilliseconds={props.debounceMilliseconds || 1200}
    />;
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface ButtonSelectOption {
    value: any,
    label: string,
    iconName?: TIconOptions,
    color: string | null,
};
export interface ButtonSelectControlProps {
    options: ButtonSelectOption[],
    initialValue: any, // value which may be coming from the database.
    onValueChanged: (val: any) => void, // caller can save the changed value to a db here.
    isSaving: boolean, // show the value as saving in progress
}

export function ButtonSelectControl(props: ButtonSelectControlProps) {
    return <DebouncedControl
        initialValue={props.initialValue}
        debounceMilliseconds={600} // faster debounce for button select because you don't hit it so much to warrant debounce
        isSaving={props.isSaving}
        onValueChanged={props.onValueChanged}
        className="ButtonArrayControl"
        render={(showingEditor, value, onChange) => {
            const selectedOption = props.options.find(o => o.value === value)!;
            const selectedStyle = GetStyleVariablesForColor(selectedOption.color);

            return <div className='valueContainer'>
                {showingEditor ? <ButtonGroup>
                    {props.options.map((option, i) => {
                        const style = GetStyleVariablesForColor(option.color);
                        return <Button
                            key={i}
                            style={style}
                            className={`applyColor-strong-noBorder ${option.value === value ? "selected" : "notSelected"}`}
                            startIcon={RenderMuiIcon(option.iconName)}
                            onClick={() => { onChange(option.value) }}>
                            {option.label}
                        </Button>;
                    })}
                </ButtonGroup>
                    :
                    <div className="value applyColor-strong-noBorder" style={selectedStyle}>{selectedOption.label}</div>}
            </div>

        }}
    />;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MutationButtonSelectControlProps {
    options: ButtonSelectOption[],
    initialValue: any,
    refetch: () => void,
    onChange: (value: any) => Promise<any>,
};

export const MutationButtonSelectControl = (props: MutationButtonSelectControlProps) => {
    const [isSaving, setIsSaving] = React.useState(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onValueChanged = (newValue: string | null) => {
        setIsSaving(true);
        props.onChange(newValue).then(x => {
            showSnackbar({ severity: "success", children: "Updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error" });
        }).finally(() => {
            setIsSaving(false);
            props.refetch();
        });
    };

    return <ButtonSelectControl
        options={props.options}
        initialValue={props.initialValue}
        isSaving={isSaving}
        onValueChanged={onValueChanged}
    />;
};

