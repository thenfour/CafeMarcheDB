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

    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (weControlValue) {
            setControlledValue(val);
        }
        onChange(e, val);
    };

    return <input
        ref={inputRef}
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
        <CMTextInputBase
            value={controlledValue}
            onChange={(e, v) => { setControlledValue(v); }}
            style={props.inputStyle}
            readOnly={props.readonly}
        />
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