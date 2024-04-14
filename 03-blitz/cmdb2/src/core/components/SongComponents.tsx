
import { useAuthenticatedSession } from '@blitzjs/auth';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HomeIcon from '@mui/icons-material/Home';
import PlaceIcon from '@mui/icons-material/Place';
import { Breadcrumbs, Button, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Link, Tab, Tabs, Tooltip } from "@mui/material";
import { Prisma } from "db";
import { useRouter } from "next/router";
import React from "react";
import { ColorVariationSpec, StandardVariationSpec } from 'shared/color';
import { Permission } from 'shared/permissions';
import { Timing } from 'shared/time';
import { IsNullOrWhitespace } from 'shared/utils';
import { useAuthorization } from 'src/auth/hooks/useAuthorization';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gIconMap } from '../db3/components/IconSelectDialog';
import { AttendanceChip, CMChipContainer, CMStandardDBChip, CMStatusIndicator, CustomTabPanel, EventDetailVerbosity, InstrumentChip, InstrumentFunctionalGroupChip, ReactiveInputDialog, TabA11yProps, } from './CMCoreComponents';
import { ChoiceEditCell } from './ChooseItemDialog';
import { GetStyleVariablesForColor } from './Color';
import { EventAttendanceControl } from './EventAttendanceComponents';
import { EventFilesTabContent } from './EventFileComponents';
import { EventFrontpageTabContent } from './EventFrontpageComponents';
import { SegmentList } from './EventSegmentComponents';
import { EventSongListTabContent } from './EventSongListComponents';
import { Markdown } from './RichTextEditor';
import { GenerateDefaultDescriptionSettingName, MutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
import { AddUserButton } from './UserComponents';
import { CMDialogContentText } from './CMCoreComponents2';


export const SongClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    name: new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
    slug: new DB3Client.SlugColumnClient({ columnName: "slug", cellWidth: 120 }),
    description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
    isDeleted: new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
    startBPM: new DB3Client.GenericIntegerColumnClient({ columnName: "startBPM", cellWidth: 100 }),
    endBPM: new DB3Client.GenericIntegerColumnClient({ columnName: "endBPM", cellWidth: 100 }),
    introducedYear: new DB3Client.GenericIntegerColumnClient({ columnName: "introducedYear", cellWidth: 100 }),
    lengthSeconds: new DB3Client.GenericIntegerColumnClient({ columnName: "lengthSeconds", cellWidth: 100 }),
    tags: new DB3Client.TagsFieldClient({ columnName: "tags", cellWidth: 200, allowDeleteFromCell: false }),
    createdByUser: new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120 }),
    visiblePermission: new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120 }),
};