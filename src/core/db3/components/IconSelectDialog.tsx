
import AddIcon from '@mui/icons-material/Add';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import CancelIcon from '@mui/icons-material/Cancel';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import CommentIcon from '@mui/icons-material/Comment';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DeleteIcon from '@mui/icons-material/Delete';
import DoneIcon from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ErrorIcon from '@mui/icons-material/Error';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FavoriteIcon from '@mui/icons-material/Favorite';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import GroupIcon from '@mui/icons-material/Group';
import GroupsIcon from '@mui/icons-material/Groups';
import HelpIcon from '@mui/icons-material/Help';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HomeIcon from '@mui/icons-material/Home';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import ImageIcon from '@mui/icons-material/Image';
import InfoIcon from '@mui/icons-material/Info';
import LaunchIcon from '@mui/icons-material/Launch';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import LinkIcon from '@mui/icons-material/Link';
import LockIcon from '@mui/icons-material/Lock';
import MicIcon from '@mui/icons-material/Mic';
import MoreIcon from '@mui/icons-material/More';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import NightlifeIcon from '@mui/icons-material/Nightlife';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PersonIcon from '@mui/icons-material/Person';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PlaceIcon from '@mui/icons-material/Place';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PublicIcon from '@mui/icons-material/Public';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SaveIcon from '@mui/icons-material/Save';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import ShareIcon from '@mui/icons-material/Share';
import StarsIcon from '@mui/icons-material/Stars';
import TagIcon from '@mui/icons-material/Tag';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import TuneIcon from '@mui/icons-material/Tune';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import React from "react";
import { TIconOptions, gIconOptions } from "shared/utils";
import { ChoiceEditCell } from "../../components/ChooseItemDialog";
//import { SettingMarkdown } from 'src/core/components/SettingMarkdown';
import { VolumeDown, VolumeOff, VolumeUp } from '@mui/icons-material';

// interface IIconMap {
//     [name: string]: () => React.ReactElement
// };

// keep in sync with export const gIconOptions = 
export const gIconMap /*: IIconMap*/ = {
    Add: () => <AddIcon />,
    AttachFile: () => <AttachFileIcon />,
    AddCircleOutline: () => <AddCircleOutlineIcon />,
    AutoAwesome: () => <AutoAwesomeIcon />,
    CalendarMonth: () => <CalendarMonthIcon />,
    Campaign: () => <CampaignIcon />,
    Cancel: () => <CancelIcon />,
    Celebration: () => <CelebrationIcon />,
    CheckCircleOutline: () => <CheckCircleOutlineIcon />,
    Close: () => <CloseIcon />,
    Comment: () => <CommentIcon />,
    ContentCopy: () => <ContentCopyIcon />,
    ContentCut: () => <ContentCutIcon />,
    ContentPaste: () => <ContentPasteIcon />,
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
    HourglassBottom: () => <HourglassBottomIcon />,
    Image: () => <ImageIcon />,
    Info: () => <InfoIcon />,
    Launch: () => <LaunchIcon />,
    LibraryMusic: () => <LibraryMusicIcon />,
    Link: () => <LinkIcon />,
    Lock: () => <LockIcon />,
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
    Schedule: () => <ScheduleIcon />,
    Search: () => <SearchIcon />,
    Security: () => <SecurityIcon />,
    Settings: () => <SettingsIcon />,
    Share: () => <ShareIcon />,
    Stars: () => <StarsIcon />,
    Tag: () => <TagIcon />,
    ThumbDown: () => <ThumbDownIcon />,
    ThumbUp: () => <ThumbUpIcon />,
    Tune: () => <TuneIcon />,
    Visibility: () => <VisibilityIcon />,
    VisibilityOff: () => <VisibilityOffIcon />,
    VolumeDown: () => <VolumeDown />,
    VolumeUp: () => <VolumeUp />,
    VolumeOff: () => <VolumeOff />,

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


export const gCharMap = {
    UpArrow: () => '\u2191',
    DownArrow: () => '\u2193',
    HorizontalEllipses: () => '\u2026',
    VerticalEllipses: () => '\u22EE',
} as const;