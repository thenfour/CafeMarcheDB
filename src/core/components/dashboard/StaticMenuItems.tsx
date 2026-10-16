import { type CmdbRouteKey, CmdbRoutes } from '@/src/route/cmdbRoutes';
import {
    AudioFileOutlined,
    BackHand,
    CalendarMonthOutlined as CalendarMonthOutlinedIcon,
    FeaturedPlayList,
    List,
    Monitor,
    MusicNote as MusicNoteIcon,
    MusicNoteOutlined as MusicNoteOutlinedIcon,
    Palette,
    PieChart,
    Settings as SettingsIcon
} from '@mui/icons-material';
import CollectionsIcon from '@mui/icons-material/Collections';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
import * as React from 'react';
import { Permission } from "shared/permissions";
import type { MenuCaptionKey } from 'src/locale/shared/menuStrings';
import { gIconMap } from "../../db3/components/IconMap";

export enum NavRealm {
    backstageHome = "",
    events = "events",
    songs = "songs",
    files = "files",
    users = "users",
    instruments = "instruments",
    wikiPages = "wikiPages",
    YourProfile = "YourProfile",
    CustomLinks = "CustomLinks",
    MenuLinks = "MenuLinks",
}

export interface MenuLink {
    type: "link";
    permission: Permission;
    linkCaption: string;
    path: string;
    routeKey?: CmdbRouteKey;

    className?: string;
    openInNewTab?: boolean;
    realm?: NavRealm;
    renderIcon: () => React.ReactNode;
    enabledForSingleTenant?: boolean; // default true
}

export type MenuContext = "band" | "platform";

export interface StaticMenuLink extends Omit<MenuLink, "linkCaption" | "routeKey"> {
    readonly captionKey: MenuCaptionKey;
    readonly routeKey: CmdbRouteKey;
    readonly context: MenuContext;
}

type MenuPresentation = Omit<MenuLink, "type" | "permission" | "linkCaption" | "path" | "routeKey">;

function pageLink(routeKey: CmdbRouteKey, captionKey: MenuCaptionKey, context: MenuContext, presentation: MenuPresentation): StaticMenuLink {
    const route = CmdbRoutes.routeByKey(routeKey);
    return {
        type: "link",
        routeKey,
        path: route.nextPattern,
        captionKey,
        context,
        permission: route.permission,
        ...presentation,
    };
}

// groups are separated by dividers
export interface MenuGroup {
    links: MenuLink[];
    className?: string; // CSS classes for visual styling of this group
}

// sections have headers
export interface MenuSection {
    name: string;
    className?: string;
    expandedByDefault?: boolean;
    groups: MenuGroup[];
}

export interface StaticMenuSection extends Omit<MenuSection, "groups"> {
    groups: (Omit<MenuGroup, "links"> & { links: StaticMenuLink[] })[];
}

// Menu context controls navigation only; pages validate their own parameters.
export const gMenuSections: StaticMenuSection[] = [
    {
        name: "Backstage",
        className: "backstage",
        expandedByDefault: true,
        groups: [
            {
                links: [
                    pageLink("/backstage", "menu.home", "band", { renderIcon: () => <HomeIcon /> }),
                    pageLink("/backstage/events", "menu.events", "band", { realm: NavRealm.events, renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                    pageLink("/backstage/songs", "menu.songs", "band", { realm: NavRealm.songs, renderIcon: () => <MusicNoteOutlinedIcon /> }),
                    pageLink("/backstage/setlistPlanner", "menu.setlistPlanner", "band", { renderIcon: () => <AudioFileOutlined /> }),
                    pageLink("/backstage/profile", "menu.profile", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("/backstage/platform-profile", "menu.platform-profile", "platform", { renderIcon: () => <PersonIcon /> }),
                    pageLink("/backstage/calendar", "menu.calendar", "band", { renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                ]
            }
        ]
    },
    {
        name: "Explore",
        groups: [
            {
                links: [
                    pageLink("/backstage/files", "menu.files", "band", { realm: NavRealm.files, renderIcon: () => gIconMap.AttachFile() }),
                    pageLink("/backstage/wikiPages", "menu.wikiPages", "band", { realm: NavRealm.wikiPages, renderIcon: () => gIconMap.Article() }),
                    pageLink("/backstage/users", "menu.users", "band", { realm: NavRealm.users, renderIcon: gIconMap.Person }),
                    pageLink("/backstage/stats", "menu.stats", "band", { renderIcon: gIconMap.Equalizer }),
                    pageLink("/backstage/featureReports", "menu.featureReports", "band", { renderIcon: () => <PieChart /> }),
                    pageLink("/backstage/platform-featureReports", "menu.platform-featureReports", "platform", { renderIcon: () => <PieChart /> }),
                ]
            }
        ]
    },
    {
        name: "Homepage",
        className: "public",
        groups: [
            {
                links: [
                    pageLink("/", "menu.homepage", "band", { renderIcon: () => gIconMap.Public(), enabledForSingleTenant: false }),
                    pageLink("/backstage/frontpagegallery", "menu.frontpagegallery", "band", { renderIcon: () => gIconMap.Image(), enabledForSingleTenant: false }),
                    pageLink("/backstage/frontpageEvents", "menu.frontpageEvents", "band", { renderIcon: () => <CalendarMonthOutlinedIcon />, enabledForSingleTenant: false }),
                ]
            }
        ]
    },
    {
        name: "Configure",
        className: "backstage",
        groups: [
            {
                links: [
                    pageLink("/backstage/menuLinks", "menu.menuLinks", "band", { renderIcon: () => <FeaturedPlayList /> }),
                    pageLink("/backstage/platform-menuLinks", "menu.platform-menuLinks", "platform", { renderIcon: () => <FeaturedPlayList /> }),
                    pageLink("/backstage/customLinks", "menu.customLinks", "band", { renderIcon: gIconMap.Link }),
                    pageLink("/backstage/platform-customLinks", "menu.platform-customLinks", "platform", { renderIcon: gIconMap.Link }),
                    pageLink("/backstage/brand", "menu.brand", "band", { renderIcon: () => <SettingsIcon /> }),
                ]
            },
            {
                links: [

                    pageLink("/backstage/editEventTags", "menu.editEventTags", "band", { renderIcon: () => gIconMap.Tag() }),

                    pageLink("/backstage/platform-editEventTags", "menu.platform-editEventTags", "platform", { renderIcon: () => gIconMap.Tag() }),
                    pageLink("/backstage/editEventTypes", "menu.editEventTypes", "band", { renderIcon: () => <SettingsIcon /> }),
                    pageLink("/backstage/editEventStatuses", "menu.editEventStatuses", "band", { renderIcon: () => <SettingsIcon /> }),
                    pageLink("/backstage/editEventAttendances", "menu.editEventAttendances", "band", { renderIcon: () => <SettingsIcon /> }),
                ]
            },
            {
                links: [

                    pageLink("/backstage/editSongTags", "menu.editSongTags", "band", { renderIcon: () => gIconMap.Tag() }),
                    pageLink("/backstage/editSongCreditTypes", "menu.editSongCreditTypes", "band", { renderIcon: () => <MusicNoteIcon /> }),
                ]
            },
            {
                links: [
                    pageLink("/backstage/editFileTags", "menu.editFileTags", "band", { renderIcon: gIconMap.Tag }),
                    pageLink("/backstage/platform-editFileTags", "menu.platform-editFileTags", "platform", { renderIcon: gIconMap.Tag }),
                ]
            },
            {
                links: [
                    pageLink("/backstage/editWikiPageTags", "menu.editWikiPageTags", "band", { renderIcon: () => gIconMap.Tag() }),
                    pageLink("/backstage/platform-editWikiPageTags", "menu.platform-editWikiPageTags", "platform", { renderIcon: () => gIconMap.Tag() }),
                ]
            },
            {
                links: [
                    pageLink("/backstage/editUserTags", "menu.editUserTags", "band", { renderIcon: () => gIconMap.Tag() }),
                ]
            },
            {
                links: [
                    pageLink("/backstage/settings", "menu.settings", "band", { renderIcon: () => <SettingsIcon /> }),
                    pageLink("/backstage/platform-settings", "menu.platform-settings", "platform", { renderIcon: () => <SettingsIcon /> }),

                ]
            },
        ]
    },
    {
        name: "Admin Tools",
        className: "admin general",
        groups: [
            {
                links: [
                    pageLink("/backstage/eventImport", "menu.eventImport", "band", { renderIcon: gIconMap.CalendarMonth }),

                    pageLink("/backstage/serverHealth", "menu.serverHealth", "platform", { renderIcon: () => <SettingsIcon /> }),
                    pageLink("/backstage/calendarPreview", "menu.calendarPreview", "band", { renderIcon: () => gIconMap.CalendarMonth() }),
                    pageLink("/backstage/gallery", "menu.gallery", "band", { renderIcon: () => <CollectionsIcon /> }),
                    pageLink("/backstage/test/attendance", "menu.attendanceTest", "platform", { renderIcon: () => <BackHand /> }),
                    pageLink("/backstage/test/date", "menu.dateTest", "platform", { renderIcon: gIconMap.CalendarMonth }),
                    pageLink("/backstage/test/dialogs", "menu.dialogTest", "platform", { renderIcon: () => <Monitor /> }),
                    pageLink("/backstage/test/CMSelectTest", "menu.selectTest", "platform", { renderIcon: () => <List /> }),
                    pageLink("/backstage/colorEditor2", "menu.colorEditor", "platform", { renderIcon: () => <Palette /> }),
                ]
            },
        ]
    },
    {
        name: "Security",
        className: "admin users",
        groups: [
            {
                className: "admin users",
                links: [
                    pageLink("/backstage/roles", "menu.roles", "band", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("/backstage/platform-roles", "menu.platform-roles", "platform", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("/backstage/permissions", "menu.permissions", "band", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("/backstage/platform-permissions", "menu.platform-permissions", "platform", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("/backstage/rolePermissions", "menu.rolePermissions", "band", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("/backstage/platform-rolePermissions", "menu.platform-rolePermissions", "platform", { renderIcon: () => <SecurityIcon /> }),
                ]
            },
        ]
    },
    {
        name: "Admin instruments",
        className: "admin users",
        groups: [
            {
                className: "admin instruments",
                links: [
                    pageLink("/backstage/instruments", "menu.instruments", "band", { renderIcon: () => <MusicNoteIcon /> }),
                    pageLink("/backstage/instrumentFunctionalGroups", "menu.instrumentFunctionalGroups", "band", { renderIcon: () => <MusicNoteIcon /> }),
                ]
            },
        ]
    },
    {
        name: "Data Grids",
        className: "admin",
        groups: [
            {
                links: [
                    pageLink("/backstage/adminUsers", "menu.adminUsers", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("/backstage/platform-adminUsers", "menu.platform-adminUsers", "platform", { renderIcon: () => <PersonIcon /> }),
                    pageLink("/backstage/editSongs", "menu.editSongs", "band", { renderIcon: () => <MusicNoteIcon /> }),
                    pageLink("/backstage/editSongCredits", "menu.editSongCredits", "band", { renderIcon: () => <MusicNoteIcon /> }),
                    pageLink("/backstage/userInstruments", "menu.userInstruments", "band", { renderIcon: () => <MusicNoteIcon /> }),
                    pageLink("/backstage/userTags", "menu.userTags", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("/backstage/userRoles", "menu.userRoles", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("/backstage/recoverMembers", "menu.recoverMembers", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("/backstage/editEvents", "menu.editEvents", "band", { renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                    pageLink("/backstage/editEventSegments", "menu.editEventSegments", "band", { renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                    pageLink("/backstage/editFiles", "menu.editFiles", "band", { renderIcon: gIconMap.AttachFile }),
                    pageLink("/backstage/editFrontpageGalleryItems", "menu.editFrontpageGalleryItems", "band", { renderIcon: gIconMap.AttachFile }),
                ]
            },
        ]
    },

] as const;
