
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CancelIcon from '@mui/icons-material/Cancel';
import CloseIcon from '@mui/icons-material/Close';
import CommentIcon from '@mui/icons-material/Comment';
import DoneIcon from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ErrorIcon from '@mui/icons-material/Error';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import GroupIcon from '@mui/icons-material/Group';
import GroupsIcon from '@mui/icons-material/Groups';
import HomeIcon from '@mui/icons-material/Home';
import InfoIcon from '@mui/icons-material/Info';
import HelpIcon from '@mui/icons-material/Help';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import LinkIcon from '@mui/icons-material/Link';
import MicIcon from '@mui/icons-material/Mic';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import NightlifeIcon from '@mui/icons-material/Nightlife';
import PersonIcon from '@mui/icons-material/Person';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PlaceIcon from '@mui/icons-material/Place';
import PublicIcon from '@mui/icons-material/Public';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import TuneIcon from '@mui/icons-material/Tune';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import React from "react";
import { TIconOptions, gIconOptions } from "shared/utils";
import { ChoiceEditCell } from "../../components/ChooseItemDialog";
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import StarsIcon from '@mui/icons-material/Stars';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import FavoriteIcon from '@mui/icons-material/Favorite';
import MoreIcon from '@mui/icons-material/More';
import LaunchIcon from '@mui/icons-material/Launch';

// interface IIconMap {
//     [name: string]: () => React.ReactElement
// };

// keep in sync with export const gIconOptions = 
export const gIconMap /*: IIconMap*/ = {
    Add: () => <AddIcon />,
    AttachFile: () => <AttachFileIcon />,
    AddCircleOutline: () => <AddCircleOutlineIcon />,
    CalendarMonth: () => <CalendarMonthIcon />,
    Campaign: () => <CampaignIcon />,
    Cancel: () => <CancelIcon />,
    Celebration: () => <CelebrationIcon />,
    CheckCircleOutline: () => <CheckCircleOutlineIcon />,
    Close: () => <CloseIcon />,
    Comment: () => <CommentIcon />,
    Delete: () => <DeleteIcon />,
    Done: () => <DoneIcon />,
    Edit: () => <EditIcon />,
    EditNote: () => <EditNoteIcon />,
    Error: () => <ErrorIcon />,
    ErrorOutline: () => <ErrorOutlineIcon />,
    Favorite: () => <FavoriteIcon />,
    GraphicEq: () => <GraphicEqIcon />,
    Group: () => <GroupIcon />,
    Groups: () => <GroupsIcon />,
    Help: () => <HelpIcon />,
    HighlightOff: () => <HighlightOffIcon />,
    Home: () => <HomeIcon />,
    Info: () => <InfoIcon />,
    Launch: () => <LaunchIcon />,
    LibraryMusic: () => <LibraryMusicIcon />,
    Link: () => <LinkIcon />,
    Mic: () => <MicIcon />,
    More: () => <MoreIcon />,
    MusicNote: () => <MusicNoteIcon />,
    Nightlife: () => <NightlifeIcon />,
    PauseCircleOutline: () => <PauseCircleOutlineIcon />,
    Person: () => <PersonIcon />,
    PersonSearch: () => <PersonSearchIcon />,
    Place: () => <PlaceIcon />,
    PlayCircleOutline: () => <PlayCircleOutlineIcon />,
    Public: () => <PublicIcon />,
    QuestionMark: () => <QuestionMarkIcon />,
    RemoveCircleOutline: () => <RemoveCircleOutlineIcon />,
    Save: () => <SaveIcon />,
    Search: () => <SearchIcon />,
    Security: () => <SecurityIcon />,
    Settings: () => <SettingsIcon />,
    Stars: () => <StarsIcon />,
    ThumbDown: () => <ThumbDownIcon />,
    ThumbUp: () => <ThumbUpIcon />,
    Tune: () => <TuneIcon />,
    Visibility: () => <VisibilityIcon />,
    VisibilityOff: () => <VisibilityOffIcon />,

} as const;

export const RenderMuiIcon = (name: TIconOptions | undefined | null | string): (React.ReactElement | null) => {
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
                {value}
                {selected && <CloseIcon />}
            </li>;
        }}
        renderValue={(value, onDelete) => {
            return <>{RenderMuiIcon(value)}</>;
        }}
    />;
}

