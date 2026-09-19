import { BackstageRouteKey, getBackstageRoute } from "@/src/auth/shared/backstageRoutes";
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
    className?: string;
    linkCaption: string;
    path: string;
    openInNewTab?: boolean;
    realm?: NavRealm;
    renderIcon: () => React.ReactNode;
    enabledForGenericSingleTenant?: boolean; // default true
    routeKey?: BackstageRouteKey;
}

type BackstageMenuPresentation = Omit<MenuLink, "type" | "permission" | "linkCaption" | "path" | "routeKey">;

const backstageLink = (routeKey: BackstageRouteKey, presentation: BackstageMenuPresentation): MenuLink => {
    const route = getBackstageRoute(routeKey);
    return {
        type: "link",
        routeKey,
        path: route.pattern,
        linkCaption: route.caption,
        permission: route.permission,
        ...presentation,
    };
};

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

// New hierarchical menu data structure
export const gMenuSections: MenuSection[] = [
    {
        name: "Backstage",
        className: "backstage",
        expandedByDefault: true,
        groups: [
            {
                links: [
                    backstageLink("home", { renderIcon: () => <HomeIcon /> }),
                    backstageLink("events", { realm: NavRealm.events, renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                    backstageLink("songs", { realm: NavRealm.songs, renderIcon: () => <MusicNoteOutlinedIcon /> }),
                    backstageLink("setlistPlanner", { renderIcon: () => <AudioFileOutlined /> }),
                    backstageLink("profile", { renderIcon: () => <PersonIcon /> }),
                    backstageLink("calendar", { renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                ]
            }
        ]
    },
    {
        name: "Explore",
        groups: [
            {
                links: [
                    backstageLink("files", { realm: NavRealm.files, renderIcon: () => gIconMap.AttachFile() }),
                    backstageLink("wikiPages", { realm: NavRealm.wikiPages, renderIcon: () => gIconMap.Article() }),
                    backstageLink("users", { realm: NavRealm.users, renderIcon: gIconMap.Person }),
                    backstageLink("stats", { renderIcon: gIconMap.Equalizer }),
                    backstageLink("featureReports", { renderIcon: () => <PieChart /> }),
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
                    { type: "link", path: "/", linkCaption: "Homepage", renderIcon: () => gIconMap.Public(), permission: Permission.visibility_public, enabledForGenericSingleTenant: false },
                    backstageLink("frontpagegallery", { renderIcon: () => gIconMap.Image(), enabledForGenericSingleTenant: false }),
                    backstageLink("frontpageEvents", { renderIcon: () => <CalendarMonthOutlinedIcon />, enabledForGenericSingleTenant: false }),
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
                    backstageLink("menuLinks", { renderIcon: () => <FeaturedPlayList /> }),
                    backstageLink("customLinks", { renderIcon: gIconMap.Link }),
                    backstageLink("brand", { renderIcon: () => <SettingsIcon /> }),
                ]
            },
            {
                links: [

                    backstageLink("editEventTags", { renderIcon: () => gIconMap.Tag() }),
                    backstageLink("editEventTypes", { renderIcon: () => <SettingsIcon /> }),
                    backstageLink("editEventStatuses", { renderIcon: () => <SettingsIcon /> }),
                    backstageLink("editEventAttendances", { renderIcon: () => <SettingsIcon /> }),
                ]
            },
            {
                links: [

                    backstageLink("editSongTags", { renderIcon: () => gIconMap.Tag() }),
                    backstageLink("editSongCreditTypes", { renderIcon: () => <MusicNoteIcon /> }),
                ]
            },
            {
                links: [
                    backstageLink("editFileTags", { renderIcon: gIconMap.Tag }),
                ]
            },
            {
                links: [
                    backstageLink("editWikiPageTags", { renderIcon: () => gIconMap.Tag() }),
                ]
            },
            {
                links: [
                    backstageLink("editUserTags", { renderIcon: () => gIconMap.Tag() }),
                ]
            },
            {
                links: [
                    backstageLink("instrumentTags", { renderIcon: () => gIconMap.Tag() }),
                ]
            },
            {
                links: [
                    backstageLink("settings", { renderIcon: () => <SettingsIcon /> }),

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
                    backstageLink("eventImport", { renderIcon: gIconMap.CalendarMonth }),
                    // backstageLink("adminLogs", { renderIcon: () => <SettingsIcon /> }),
                    backstageLink("serverHealth", { renderIcon: () => <SettingsIcon /> }),
                    backstageLink("calendarPreview", { renderIcon: () => gIconMap.CalendarMonth() }),
                    backstageLink("gallery", { renderIcon: () => <CollectionsIcon /> }),
                    backstageLink("attendanceTest", { renderIcon: () => <BackHand /> }),
                    backstageLink("dateTest", { renderIcon: gIconMap.CalendarMonth }),
                    backstageLink("dialogTest", { renderIcon: () => <Monitor /> }),
                    backstageLink("selectTest", { renderIcon: () => <List /> }),
                    backstageLink("colorEditor", { renderIcon: () => <Palette /> }),
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
                    backstageLink("roles", { renderIcon: () => <SecurityIcon /> }),
                    backstageLink("permissions", { renderIcon: () => <SecurityIcon /> }),
                    backstageLink("rolePermissions", { renderIcon: () => <SecurityIcon /> }),
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
                    backstageLink("instruments", { renderIcon: () => <MusicNoteIcon /> }),
                    backstageLink("instrumentFunctionalGroups", { renderIcon: () => <MusicNoteIcon /> }),
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
                    backstageLink("adminUsers", { renderIcon: () => <PersonIcon /> }),
                    backstageLink("editSongs", { renderIcon: () => <MusicNoteIcon /> }),
                    backstageLink("editSongCredits", { renderIcon: () => <MusicNoteIcon /> }),
                    backstageLink("userInstruments", { renderIcon: () => <MusicNoteIcon /> }),
                    backstageLink("editEvents", { renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                    backstageLink("editEventSegments", { renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                    backstageLink("editFiles", { renderIcon: gIconMap.AttachFile }),
                    backstageLink("editFrontpageGalleryItems", { renderIcon: gIconMap.AttachFile }),
                ]
            },
        ]
    },

] as const;
