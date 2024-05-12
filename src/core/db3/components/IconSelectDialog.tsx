import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { TIconOptions, gIconOptions } from "shared/utils";
import { ChoiceEditCell } from "../../components/ChooseItemDialog";
import { RenderMuiIcon } from "./IconMap";

export interface ChooseIconDialogProps {
    value: TIconOptions | null;
    validationError: string | null;
    onOK: (value: TIconOptions | null) => void;
    readonly: boolean;
};

export function IconEditCell(props: ChooseIconDialogProps) {
    return <ChoiceEditCell
        selectDialogTitle="Select icon"
        dialogDescription={""}
        items={Object.keys(gIconOptions)}
        readonly={props.readonly}
        value={props.value}
        onChange={(value) => props.onOK(value)}
        selectButtonLabel="Icon..."
        validationError={props.validationError}
        isEqual={(a, b) => a === b} // just strings
        renderAsListItem={(props, value, selected) => {
            return <li {...props}>
                {selected && <DoneIcon />}
                {RenderMuiIcon(value)}
                {value}
                {selected && <CloseIcon />}
            </li>;
        }}
        renderValue={(args) => {
            return <>{RenderMuiIcon(args.value)}</>;
        }}
    />;
}
