import { type CmdbRouteKey, CmdbRouteRegistry } from '@/src/route/cmdbRoutes';
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
import type { PermissionRequirement } from "src/auth/shared/permissionRequirement";
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
    permission: PermissionRequirement;
    linkCaption: string;
    path: string;
    routeKey?: CmdbRouteKey;

    className?: string;
    openInNewTab?: boolean;
    realm?: NavRealm;
    renderIcon?: () => React.ReactNode;
    enabledForSingleTenant?: boolean; // default true
}

// dashboards are band-scoped or platform-scoped
export type MenuContext = "band" | "platform";

export interface StaticMenuLink extends Omit<MenuLink, "linkCaption" | "routeKey"> {
    readonly captionKey: MenuCaptionKey;
    readonly routeKey: CmdbRouteKey;
    readonly context: MenuContext;
}

type MenuPresentation = Omit<MenuLink, "type" | "permission" | "linkCaption" | "path" | "routeKey">;

function pageLink(routeKey: CmdbRouteKey, captionKey: MenuCaptionKey, context: MenuContext, presentation: MenuPresentation): StaticMenuLink {
    const route = CmdbRouteRegistry.routeByKey(routeKey);
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
        name: "CMDB",
        className: "platform_scope",
        expandedByDefault: true,
        groups: [
            {
                links: [
                    // should appear on both band- and platform-scoped dashboards
                    pageLink("platformRoot", "menu.platformHome", "platform", { renderIcon: () => <HomeIcon /> }),
                    pageLink("platformRoot", "menu.platformHome", "band", { renderIcon: () => <HomeIcon /> }),

                    // should appear on both band- and platform-scoped dashboards
                    pageLink("platformProfile", "menu.platform-profile", "platform", { renderIcon: () => <PersonIcon /> }),
                    pageLink("platformProfile", "menu.platform-profile", "band", { renderIcon: () => <PersonIcon /> }),

                    pageLink("platformFeatureReports", "menu.platform-featureReports", "platform", { renderIcon: () => <PieChart /> }),

                    // hmm need to think about menu links & custom links at  platform-level... do we really support this?
                    pageLink("platformMenuLinks", "menu.platform-menuLinks", "platform", { renderIcon: () => <FeaturedPlayList /> }),
                    pageLink("platformCustomLinks", "menu.platform-customLinks", "platform", { renderIcon: gIconMap.Link }),
                ]
            }
        ]
    },
    {
        name: "Backstage",
        className: "band_scope backstage",
        expandedByDefault: true,
        groups: [
            {
                links: [
                    pageLink("bandRoot", "menu.home", "band", { renderIcon: () => <HomeIcon /> }),
                    pageLink("bandEvents", "menu.events", "band", { realm: NavRealm.events, renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                    pageLink("bandSongs", "menu.songs", "band", { realm: NavRealm.songs, renderIcon: () => <MusicNoteOutlinedIcon /> }),
                    pageLink("bandSetlistPlanner", "menu.setlistPlanner", "band", { renderIcon: () => <AudioFileOutlined /> }),
                    pageLink("bandProfile", "menu.profile", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("bandCalendar", "menu.calendar", "band", { renderIcon: () => <CalendarMonthOutlinedIcon /> }),
                ]
            }
        ]
    },
    {
        name: "Explore",
        groups: [
            {
                links: [
                    pageLink("bandFiles", "menu.files", "band", { realm: NavRealm.files, renderIcon: () => gIconMap.AttachFile() }),
                    pageLink("bandWikiPages", "menu.wikiPages", "band", { realm: NavRealm.wikiPages, renderIcon: () => gIconMap.Article() }),
                    pageLink("bandUsers", "menu.users", "band", { realm: NavRealm.users, renderIcon: gIconMap.Person }),
                    pageLink("bandStats", "menu.stats", "band", { renderIcon: gIconMap.Equalizer }),
                    pageLink("bandFeatureReports", "menu.featureReports", "band", { renderIcon: () => <PieChart /> }),
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
                    pageLink("root", "menu.homepage", "band", { renderIcon: () => gIconMap.Public(), enabledForSingleTenant: false }),
                    pageLink("bandFrontpagegallery", "menu.frontpagegallery", "band", { renderIcon: () => gIconMap.Image(), enabledForSingleTenant: false }),
                    pageLink("bandFrontpageEvents", "menu.frontpageEvents", "band", { renderIcon: () => <CalendarMonthOutlinedIcon />, enabledForSingleTenant: false }),
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
                    pageLink("bandMenuLinks", "menu.menuLinks", "band", { renderIcon: () => <FeaturedPlayList /> }),
                    pageLink("bandCustomLinks", "menu.customLinks", "band", { renderIcon: gIconMap.Link }),
                    pageLink("bandBrand", "menu.brand", "band", { renderIcon: () => <SettingsIcon /> }),
                ]
            },
            {
                links: [

                    pageLink("bandEditEventTags", "menu.editEventTags", "band", { renderIcon: () => gIconMap.Tag() }),
                    pageLink("bandEditEventTypes", "menu.editEventTypes", "band", { renderIcon: () => <SettingsIcon /> }),
                    pageLink("bandEditEventStatuses", "menu.editEventStatuses", "band", { renderIcon: () => <SettingsIcon /> }),
                    pageLink("bandEditEventAttendances", "menu.editEventAttendances", "band", { renderIcon: () => <SettingsIcon /> }),
                    pageLink("bandEditSongTags", "menu.editSongTags", "band", { renderIcon: () => gIconMap.Tag() }),
                    pageLink("bandEditSongCreditTypes", "menu.editSongCreditTypes", "band", { renderIcon: () => <MusicNoteIcon /> }),
                    pageLink("bandEditFileTags", "menu.editFileTags", "band", { renderIcon: gIconMap.Tag }),
                    pageLink("bandEditWikiPageTags", "menu.editWikiPageTags", "band", { renderIcon: () => gIconMap.Tag() }),
                    pageLink("bandEditUserTags", "menu.editUserTags", "band", { renderIcon: () => gIconMap.Tag() }),
                ]
            },
            {
                links: [
                    pageLink("bandSettings", "menu.settings", "band", { renderIcon: () => <SettingsIcon /> }),

                ]
            },
        ]
    },
    {
        name: "CMDB Catalogs",
        className: "platform_scope",
        groups: [
            {
                links: [
                    pageLink("platformEditEventTags", "menu.platform-editEventTags", "platform", { renderIcon: () => gIconMap.Tag() }),
                    pageLink("platformEditFileTags", "menu.platform-editFileTags", "platform", { renderIcon: gIconMap.Tag }),
                    pageLink("platformEditWikiPageTags", "menu.platform-editWikiPageTags", "platform", { renderIcon: () => gIconMap.Tag() }),
                    pageLink("platformSettings", "menu.platform-settings", "platform", { renderIcon: () => <SettingsIcon /> }),
                    pageLink("platformAdminUsers", "menu.platform-adminUsers", "platform", { renderIcon: () => <PersonIcon /> }),
                    pageLink("platformRoles", "menu.platform-roles", "platform", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("platformPermissions", "menu.platform-permissions", "platform", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("platformRolePermissions", "menu.platform-rolePermissions", "platform", { renderIcon: () => <SecurityIcon /> }),
                ]
            }
        ]
    },
    {
        name: "Developer pages",
        className: "admin ",
        groups: [
            {
                links: [
                    pageLink("bandCalendarPreview", "menu.calendarPreview", "band", { renderIcon: () => gIconMap.CalendarMonth() }),
                    pageLink("devGallery", "menu.gallery", "platform", { renderIcon: () => <CollectionsIcon /> }),
                    pageLink("devtestAttendance", "menu.attendanceTest", "platform", { renderIcon: () => <BackHand /> }),
                    pageLink("devtestDate", "menu.dateTest", "platform", { renderIcon: gIconMap.CalendarMonth }),
                    pageLink("devtestDialogs", "menu.dialogTest", "platform", { renderIcon: () => <Monitor /> }),
                    pageLink("devtestCMSelectTest", "menu.selectTest", "platform", { renderIcon: () => <List /> }),
                    pageLink("devColorEditor2", "menu.colorEditor", "platform", { renderIcon: () => <Palette /> }),
                ]
            }
        ]
    },
    {
        name: "Admin Tools",
        className: "admin general",
        groups: [
            {
                links: [
                    pageLink("bandEventImport", "menu.eventImport", "band", { renderIcon: gIconMap.CalendarMonth }),
                    pageLink("serverHealth", "menu.serverHealth", "platform", { renderIcon: () => <SettingsIcon /> }),
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
                    pageLink("bandRoles", "menu.roles", "band", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("bandPermissions", "menu.permissions", "band", { renderIcon: () => <SecurityIcon /> }),
                    pageLink("bandRolePermissions", "menu.rolePermissions", "band", { renderIcon: () => <SecurityIcon /> }),
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
                    pageLink("bandInstruments", "menu.instruments", "band", { renderIcon: () => <MusicNoteIcon /> }),
                    pageLink("bandInstrumentFunctionalGroups", "menu.instrumentFunctionalGroups", "band", { renderIcon: () => <MusicNoteIcon /> }),
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
                    pageLink("bandAdminUsers", "menu.adminUsers", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("bandEditSongCredits", "menu.editSongCredits", "band", { renderIcon: () => <MusicNoteIcon /> }),
                    pageLink("bandUserInstruments", "menu.userInstruments", "band", { renderIcon: () => <MusicNoteIcon /> }),
                    pageLink("bandUserTags", "menu.userTags", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("bandUserRoles", "menu.userRoles", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("bandRecoverMembers", "menu.recoverMembers", "band", { renderIcon: () => <PersonIcon /> }),
                    pageLink("bandEditFiles", "menu.editFiles", "band", { renderIcon: gIconMap.AttachFile }),
                    pageLink("bandEditFrontpageGalleryItems", "menu.editFrontpageGalleryItems", "band", { renderIcon: gIconMap.AttachFile }),
                ]
            },
        ]
    },

] as const;
