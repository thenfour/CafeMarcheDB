
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
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
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
import TerminalIcon from '@mui/icons-material/Terminal';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import TuneIcon from '@mui/icons-material/Tune';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import React from "react";
import { TIconOptions } from "shared/utils";
import { AccountTree, Alarm, Equalizer, Notifications, VolumeDown, VolumeOff, VolumeUp } from '@mui/icons-material';

// interface IIconMap {
//     [name: string]: () => React.ReactElement
// };


// https://www.svgrepo.com/svg/67252/trumpet
const TrumpetIcon = ({ color = 'currentColor', size = 24, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 512 512"
        transform='rotate(-45)'
        fill={color}
        {...props}
    >
        <path d="M478.609,150.261v24.69c-21.811,14.64-94.102,58.789-172.522,58.789h-31.801v-27.826h-33.391v27.826h-11.13v-27.826
          h-33.391v27.826h-11.13v-27.826h-33.391v27.826H33.391v-16.696H0v66.783h33.391V267.13h61.705
          c-1.853,5.226-2.872,10.843-2.872,16.696c0,27.619,22.469,50.087,50.087,50.087h9.54v27.826h33.391v-27.826h11.13v27.826h33.391
          v-27.826h11.13v27.826h33.391v-27.826h9.54c27.619,0,50.087-22.468,50.087-50.087c0-5.296-0.833-10.399-2.363-15.194
          c68.006,7.841,127.604,44.284,147.059,57.303v24.674H512V150.261H478.609z M151.85,300.522h-9.54
          c-9.206,0-16.696-7.489-16.696-16.696c0-9.206,7.49-16.696,16.696-16.696h9.54V300.522z M196.373,300.522h-11.13V267.13h11.13
          V300.522z M240.895,300.522h-11.13V267.13h11.13V300.522z M283.826,300.522h-9.54V267.13h9.54c9.207,0,16.696,7.49,16.696,16.696
          C300.522,293.033,293.033,300.522,283.826,300.522z"/>
    </svg>
);


// keep in sync with export const gIconOptions = 
export const gIconMap /*: IIconMap*/ = {
    AccountTree: () => <AccountTree />,
    Add: () => <AddIcon />,
    Alarm: () => <Alarm />,
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
    DirectionsCar: () => <DirectionsCarIcon />,
    Done: () => <DoneIcon />,
    Edit: () => <EditIcon />,
    EditNote: () => <EditNoteIcon />,
    Error: () => <ErrorIcon />,
    ErrorOutline: () => <ErrorOutlineIcon />,
    Equalizer: () => <Equalizer />,
    ExpandMore: () => <ExpandMoreIcon />,
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
    Notifications: () => <Notifications />,
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
    Terminal: () => <TerminalIcon />,
    ThumbDown: () => <ThumbDownIcon />,
    ThumbUp: () => <ThumbUpIcon />,
    Trumpet: () => <TrumpetIcon />,
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


export const gCharMap = {
    UpArrow: () => '\u2191',
    DownArrow: () => '\u2193',
    HorizontalEllipses: () => '\u2026',
    VerticalEllipses: () => '\u22EE',
    Checkmark: () => '✓',
    RightTriangle: () => '▶',
    LeftTriangle: () => '◀',
    BustInSilhouette: () => <>&#x1F464;</>,
    Hamburger: () => `☰`,
    Alert: () => `⚠`,
} as const;
