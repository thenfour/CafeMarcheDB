import {
    AudioFileOutlined,
    CalendarMonthOutlined as CalendarMonthOutlinedIcon,
    FeaturedPlayList,
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

// NavRealm enum - used for navigation context
export enum NavRealm {
    backstageHome = "",
    events = "events",
    songs = "songs",
    files = "files",
    users = "users",
    wikiPages = "wikiPages",
    YourProfile = "YourProfile",
    CustomLinks = "CustomLinks",
    MenuLinks = "MenuLinks",
}

// New hierarchical menu schema types
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

// New hierarchical menu data structure
export const gMenuSections: MenuSection[] = [
    {
        name: "Backstage",
        className: "backstage",
        expandedByDefault: true,
        groups: [
            {
                links: [
                    { type: "link", path: "/backstage", linkCaption: "Home", renderIcon: () => <HomeIcon />, permission: Permission.login },
                    { type: "link", path: "/backstage/events", realm: NavRealm.events, linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.view_events_nonpublic },
                    { type: "link", path: "/backstage/songs", realm: NavRealm.songs, linkCaption: "Songs", renderIcon: () => <MusicNoteOutlinedIcon />, permission: Permission.view_songs },
                    { type: "link", path: "/backstage/setlistPlanner", linkCaption: "Setlist Planner", renderIcon: () => <AudioFileOutlined />, permission: Permission.setlist_planner_access },
                    { type: "link", path: "/backstage/profile", linkCaption: "Your Profile", renderIcon: () => <PersonIcon />, permission: Permission.login },
                ]
            }
        ]
    },
    {
        name: "Explore",
        groups: [
            {
                links: [
                    { type: "link", path: "/backstage/files", realm: NavRealm.files, linkCaption: "File search", renderIcon: () => gIconMap.AttachFile(), permission: Permission.access_file_landing_page },
                    { type: "link", path: "/backstage/wikiPages", realm: NavRealm.wikiPages, linkCaption: "Wiki search", renderIcon: () => gIconMap.Article(), permission: Permission.search_wiki_pages },
                    { type: "link", path: "/backstage/users", realm: NavRealm.users, linkCaption: "User search", renderIcon: gIconMap.Person, permission: Permission.admin_users },
                    { type: "link", path: "/backstage/stats", linkCaption: "Event Stats", renderIcon: gIconMap.Equalizer, permission: Permission.view_events_reports },
                    { type: "link", path: "/backstage/featureReports", linkCaption: "Feature Usage", renderIcon: () => <PieChart />, permission: Permission.view_feature_reports },
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
                    { type: "link", path: "/backstage/frontpagegallery", linkCaption: "Photo Gallery", renderIcon: () => gIconMap.Image(), permission: Permission.edit_public_homepage, enabledForGenericSingleTenant: false },
                    { type: "link", path: "/backstage/frontpageEvents", linkCaption: "Agenda", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.edit_public_homepage, enabledForGenericSingleTenant: false },
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
                    { type: "link", path: "/backstage/menuLinks", linkCaption: "Menu Links", renderIcon: () => <FeaturedPlayList />, permission: Permission.customize_menu },
                    { type: "link", path: "/backstage/customLinks", linkCaption: "Custom URLs", renderIcon: gIconMap.Link, permission: Permission.view_custom_links },
                    { type: "link", path: "/backstage/brand", linkCaption: "Brand", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                ]
            },
            {
                links: [

                    { type: "link", path: "/backstage/editEventTags", linkCaption: "Event Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventTypes", linkCaption: "Event Types", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventStatuses", linkCaption: "Event Statuses", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventAttendances", linkCaption: "Event Attendance Options", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventCustomFields", linkCaption: "Event Custom Fields", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                ]
            },
            {
                links: [

                    { type: "link", path: "/backstage/editSongTags", linkCaption: "Song Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editSongCreditTypes", linkCaption: "Song Credit Types", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                ]
            },
            {
                links: [
                    { type: "link", path: "/backstage/editFileTags", linkCaption: "File Tags", renderIcon: gIconMap.Tag, permission: Permission.sysadmin },
                ]
            },
            {
                links: [
                    { type: "link", path: "/backstage/editWikiPageTags", linkCaption: "Wiki Page Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
                ]
            },
            {
                links: [
                    { type: "link", path: "/backstage/editUserTags", linkCaption: "User Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.admin_users },
                ]
            },
            {
                links: [
                    { type: "link", path: "/backstage/instrumentTags", linkCaption: "Instrument Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
                ]
            },
            {
                links: [


                    { type: "link", path: "/backstage/settings", linkCaption: "Settings", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },

                ]
            },
            {
                links: [
                    { type: "link", path: "/backstage/workflows", linkCaption: "Workflows", renderIcon: gIconMap.AccountTree, permission: Permission.view_workflow_defs },
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
                    { type: "link", path: "/backstage/eventImport", linkCaption: "Import events", renderIcon: gIconMap.CalendarMonth, permission: Permission.admin_events },
                    //{ type: "link", path: "/backstage/adminLogs", linkCaption: "Logs", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/serverHealth", linkCaption: "Server health", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/calendarPreview", linkCaption: "iCal Preview", renderIcon: () => gIconMap.CalendarMonth(), permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/gallery", linkCaption: "Component Gallery", renderIcon: () => <CollectionsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/colorEditor2", linkCaption: "Color Editor", renderIcon: () => <Palette />, permission: Permission.sysadmin },
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
                    { type: "link", path: "/backstage/roles", linkCaption: "Roles", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
                    { type: "link", path: "/backstage/permissions", linkCaption: "Permissions", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
                    { type: "link", path: "/backstage/rolePermissions", linkCaption: "Permission matrix", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
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
                    { type: "link", path: "/backstage/instruments", linkCaption: "Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/instrumentFunctionalGroups", linkCaption: "Functional Groups", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
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
                    { type: "link", path: "/backstage/editSongs", linkCaption: "Songs", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editSongCredits", linkCaption: "Song Credits", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/userInstruments", linkCaption: "User Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEvents", linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventSegments", linkCaption: "Event Segments", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editFiles", linkCaption: "Files", renderIcon: gIconMap.AttachFile, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editFrontpageGalleryItems", linkCaption: "Front page gallery", renderIcon: gIconMap.AttachFile, permission: Permission.sysadmin },
                ]
            },
        ]
    },

] as const;
