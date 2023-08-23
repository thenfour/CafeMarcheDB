import {
    TextField
} from "@mui/material";

// validation should probably NOT be done per-field.
// but rather, validation done as Zod is designed at the object level, then error object is passed down into fields

// callers controls the value

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

