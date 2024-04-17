
import { useAuthenticatedSession } from '@blitzjs/auth';
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Link, Tab, Tabs, Tooltip } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { StandardVariationSpec } from 'shared/color';
import { formatSongLength } from 'shared/time';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gIconMap } from '../db3/components/IconSelectDialog';
import { CMChipContainer, CMStandardDBChip, CustomTabPanel, TabA11yProps } from './CMCoreComponents';
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from './EditFieldsDialog';
import { MutationMarkdownControl, SettingMarkdown } from './SettingMarkdown';
import { SongCreditsControl } from './SongCreditsControls';
import { FilesTabContent } from './SongFileComponents';
import { VisibilityValue } from './VisibilityControl';


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SongWithMetadata {
    song: db3.SongPayload_Verbose;
    songURI: string;
    formattedBPM: null | string;
    formattedLength: null | string;
};

export const CalculateSongMetadata = (song: db3.SongPayload_Verbose, tabSlug?: string | undefined | null): SongWithMetadata => {
    return {
        song,
        songURI: API.songs.getURIForSong(song, tabSlug || undefined),
        formattedBPM: (song.startBPM === null && song.endBPM === null) ? null : API.songs.getFormattedBPM(song),
        formattedLength: song.lengthSeconds === null ? null : formatSongLength(song.lengthSeconds),
    };
};

