import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { TIconOptions, gIconOptions } from "shared/utils";
import { ChoiceEditCell } from "../../components/select/ChooseItemDialog";
import { RenderMuiIcon } from "./IconMap";
import { gNullValue } from '@/shared/rootroot';

export interface ChooseIconDialogProps {
    value: TIconOptions | null;
    validationError: string | null;
    onOK: (value: TIconOptions | null) => void;
    readonly: boolean;
    allowNull: boolean;
};

export function IconEditCell(props: ChooseIconDialogProps) {

    const items = props.allowNull ? [gNullValue, ...Object.keys(gIconOptions)] : Object.keys(gIconOptions);

    return <ChoiceEditCell
        selectDialogTitle="Select icon"
        dialogDescription={""}
        items={items}
        readonly={props.readonly}
        value={props.value}
        onChange={(value) => props.onOK(value)}
        selectButtonLabel="Icon..."
        validationError={props.validationError}
        isEqual={(a, b) => a === b} // just strings / null
        renderAsListItem={(props, value, selected) => {
            if (value === gNullValue) {
                return <li {...props}>
                    {selected && <DoneIcon />}
                    (none)
                    {selected && <CloseIcon />}
                </li>;
            }
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
