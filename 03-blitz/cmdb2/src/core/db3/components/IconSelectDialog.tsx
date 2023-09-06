
import {
    Box,
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Divider,
    InputBase,
    List,
    ListItemButton
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { Suspense } from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { ForeignSingleFieldClient, useForeignSingleFieldRenderContext } from "./db3ForeignSingleFieldClient";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import PlaceIcon from '@mui/icons-material/Place';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ErrorIcon from '@mui/icons-material/Error';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { TIconOptions, gIconOptions } from "shared/utils";
import { ChoiceEditCell } from "../../components/ChooseItemDialog";
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';




interface IIconMap {
    [name: string]: () => React.ReactElement
};
const gIconMap: IIconMap = {
    Add: () => <AddIcon />,
    CalendarMonth: () => <CalendarMonthIcon />,
    Check: () => <CheckIcon />,
    CheckCircleOutline: () => <CheckCircleOutlineIcon />,
    Close: () => <CloseIcon />,
    Done: () => <DoneIcon />,
    Edit: () => <EditIcon />,
    Error: () => <ErrorIcon />,
    ErrorOutline: () => <ErrorOutlineIcon />,
    HighlightOff: () => <HighlightOffIcon />,
    Place: () => <PlaceIcon />,
    Question: () => <QuestionMarkIcon />,
    Search: () => <SearchIcon />,
    ThumbDown: () => <ThumbDownIcon />,
    ThumbUp: () => <ThumbUpIcon />,
};

export const RenderMuiIcon = (name: TIconOptions | null): (React.ReactElement | null) => {
    if (name == null) return null;
    if (!gIconMap[name]) return null;
    return gIconMap[name]!();
};



export interface ChooseIconDialogProps {
    value: TIconOptions | null;
    validationError: string | null;
    onOK: (value: TIconOptions | null) => void;
};

export function IconEditCell(props: ChooseIconDialogProps) {
    return <ChoiceEditCell
        selectDialogTitle="Select icon"
        renderDialogDescription={() => <>a description here</>}
        items={Object.keys(gIconOptions)}
        readOnly={false}
        value={props.value}
        onChange={(value) => props.onOK(value)}
        selectButtonLabel="Icon..."
        validationError={props.validationError}
        isEqual={(a, b) => a === b} // just strings
        renderAsListItem={(props, value, selected) => {
            return <li {...props}>
                {selected && <DoneIcon />}
                {RenderMuiIcon(value)}
                {selected && <CloseIcon />}
            </li>;
        }}
        renderValue={(value, onDelete) => {
            return <>{RenderMuiIcon(value)}</>;
        }}
    />;
}

