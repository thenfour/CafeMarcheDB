import {
    AudioFileOutlined,
    CalendarMonthOutlined as CalendarMonthOutlinedIcon,
    MusicNote as MusicNoteIcon,
    MusicNoteOutlined as MusicNoteOutlinedIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import CollectionsIcon from '@mui/icons-material/Collections';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
import { Box, Collapse, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Typography } from '@mui/material';
import { assert } from "blitz";
import Link from "next/link";
import { useRouter } from "next/router";
import * as React from 'react';
import * as DynMenu from "shared/dynMenuTypes";
import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import { AppContextMarker } from "./AppContext";
import { DashboardContext, DashboardContextData, useClientTelemetryEvent } from "./DashboardContext";
import { ActivityFeature } from "./featureReports/activityTracking";

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
}

export interface MenuGroup {
    links: MenuLink[];
    className?: string; // CSS classes for visual styling of this group
}

export interface MenuSection {
    name: string;
    className?: string;
    expandedByDefault?: boolean;
    groups: MenuGroup[];
}

// Flattened types for rendering (used internally by flattening functions)
export interface FlatMenuItemDivider {
    type: "divider";
}

export interface FlatMenuItemSectionHeader {
    type: "sectionHeader";
    sectionName: string;
    sectionId: string;
}

export interface FlatMenuItemLink {
    type: "link";
    permission: Permission;
    className?: string;
    linkCaption: string;
    path: string;
    openInNewTab?: boolean;
    realm?: NavRealm;
    renderIcon: () => React.ReactNode;
    sectionId?: string; // Which section this link belongs to (for collapse/expand)
}

export type FlatMenuItemSpec = FlatMenuItemDivider | FlatMenuItemSectionHeader | FlatMenuItemLink;

// Container type for flattened menu items with their originating section
export interface FlatMenuSection {
    section: MenuSection;
    className?: string;
}

export type FlatMenuItemAndSection = { sectionInfo: FlatMenuSection, item: FlatMenuItemSpec };

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
                    { type: "link", path: "/backstage/stats", linkCaption: "Stats", renderIcon: gIconMap.Equalizer, permission: Permission.view_events_nonpublic },
                    { type: "link", path: "/backstage/files", realm: NavRealm.files, linkCaption: "Files", renderIcon: () => gIconMap.AttachFile(), permission: Permission.access_file_landing_page },
                    { type: "link", path: "/backstage/users", realm: NavRealm.users, linkCaption: "Users", renderIcon: gIconMap.Person, permission: Permission.admin_users },
                    { type: "link", path: "/backstage/wikiPages", realm: NavRealm.wikiPages, linkCaption: "Wiki pages", renderIcon: () => gIconMap.Article(), permission: Permission.view_wiki_pages },
                ]
            }
        ]
    },
    {
        name: "Public",
        className: "public",
        groups: [
            {
                links: [
                    { type: "link", path: "/", linkCaption: "Homepage", renderIcon: () => gIconMap.Public(), permission: Permission.visibility_public },
                    { type: "link", path: "/backstage/frontpagegallery", linkCaption: "Homepage Photos", renderIcon: () => gIconMap.Image(), permission: Permission.edit_public_homepage },
                    { type: "link", path: "/backstage/frontpageEvents", linkCaption: "Homepage Agenda", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.edit_public_homepage },
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
                    { type: "link", path: "/backstage/menuLinks", linkCaption: "Manage Menu Links", renderIcon: gIconMap.Settings, permission: Permission.customize_menu },
                    { type: "link", path: "/backstage/customLinks", linkCaption: "Custom Links", renderIcon: gIconMap.Link, permission: Permission.view_custom_links },
                    { type: "link", path: "/backstage/workflows", linkCaption: "Workflows", renderIcon: gIconMap.AccountTree, permission: Permission.view_workflow_defs },
                ]
            }
        ]
    },
    {
        name: "Admin",
        className: "admin general",
        groups: [
            {
                links: [
                    { type: "link", path: "/backstage/eventImport", linkCaption: "Import events", renderIcon: gIconMap.CalendarMonth, permission: Permission.admin_events },
                    { type: "link", path: "/backstage/featureReports", linkCaption: "Feature Usage", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/adminLogs", linkCaption: "Logs", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/serverHealth", linkCaption: "Server health", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/calendarPreview", linkCaption: "iCal Preview", renderIcon: () => gIconMap.CalendarMonth(), permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/gallery", linkCaption: "Component Gallery", renderIcon: () => <CollectionsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/colorEditor2", linkCaption: "Color Editor", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                ]
            },
        ]
    },
    {
        name: "Admin users",
        className: "admin users",
        groups: [
            {
                className: "admin users",
                links: [
                    { type: "link", path: "/backstage/editUserTags", linkCaption: "Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.admin_users },
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
                    { type: "link", path: "/backstage/userInstruments", linkCaption: "User Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/instrumentFunctionalGroups", linkCaption: "Functional Groups", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/instrumentTags", linkCaption: "Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
                ]
            },
        ]
    },
    {
        name: "Admin songs",
        className: "admin songs",
        groups: [
            {
                className: "admin songs",
                links: [
                    { type: "link", path: "/backstage/editSongs", linkCaption: "Songs", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editSongCredits", linkCaption: "Song Credits", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editSongTags", linkCaption: "Song Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editSongCreditTypes", linkCaption: "Credit Types", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
                ]
            },
        ]
    },
    {
        name: "Admin events",
        className: "admin events",
        groups: [
            {
                className: "admin events",
                links: [
                    { type: "link", path: "/backstage/editEventTypes", linkCaption: "Event Types", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventStatuses", linkCaption: "Event Statuses", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventTags", linkCaption: "Event Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventAttendances", linkCaption: "Attendance Options", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventCustomFields", linkCaption: "CustomFields", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                ]
            },
            {
                className: "admin events",
                links: [
                    { type: "link", path: "/backstage/editEvents", linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editEventSegments", linkCaption: "Event Segments", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.sysadmin },
                ]
            },
        ]
    },
    {
        name: "Admin files",
        className: "admin files",
        groups: [
            {
                className: "admin files",
                links: [
                    { type: "link", path: "/backstage/editFileTags", linkCaption: "File Tags", renderIcon: gIconMap.Tag, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editFiles", linkCaption: "Files", renderIcon: gIconMap.AttachFile, permission: Permission.sysadmin },
                    { type: "link", path: "/backstage/editFrontpageGalleryItems", linkCaption: "Front page gallery", renderIcon: gIconMap.AttachFile, permission: Permission.sysadmin },
                ]
            },
        ]
    },
    {
        name: "Admin wiki",
        className: "admin wiki",
        groups: [
            {
                className: "admin wiki",
                links: [
                    { type: "link", path: "/backstage/editWikiPageTags", linkCaption: "Wiki Page Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
                ]
            },
        ]
    },
    {
        name: "Admin settings",
        className: "admin settings",
        groups: [
            {
                className: "admin settings",
                links: [
                    { type: "link", path: "/backstage/settings", linkCaption: "Settings", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
                ]
            },
        ]
    },
];

// Helper function to convert dynamic menu items to static menu items
export const DynMenuToMenuItem = (item: db3.MenuLinkPayload, dashboardContext: DashboardContextData): MenuLink | null => {
    let path = "";
    let openInNewTab = false;
    switch (item.linkType as keyof typeof DynMenu.DynamicMenuLinkType) {
        case "ExternalURL":
            openInNewTab = true;
            path = item.externalURI || "";
            break;
        case "Wiki":
            path = item.wikiSlug ? `/backstage/wiki/${slugify(item.wikiSlug)}` : "";
            break;
    }

    const pobj = dashboardContext.permission.getById(item.visiblePermissionId);

    return {
        type: "link",
        permission: (pobj?.name || Permission.never_grant) as Permission,
        className: item.itemCssClass,
        linkCaption: item.caption,
        renderIcon: item.iconName ? gIconMap[item.iconName] : undefined,
        path,
        openInNewTab,
    };
};

// New flattening function for hierarchical menu structure
export const FlattenMenuSections = (
    dashboardContext: DashboardContextData,
    sections: MenuSection[],
    expandedSections: Set<string>
): FlatMenuItemAndSection[] => {
    const menuItems: FlatMenuItemAndSection[] = [];

    for (let iSection = 0; iSection < sections.length; ++iSection) {
        const section = sections[iSection]!;
        const sectionId = section.name;
        let hasAuthorizedItems = false;

        // Check if any items in this section are authorized
        const checkAuthorizedItems = (links: MenuLink[]): boolean => {
            return links.some(link => dashboardContext.isAuthorized(link.permission));
        };

        const hasAuthorizedLinks = section.groups.some(group =>
            checkAuthorizedItems(group.links)
        );

        if (!hasAuthorizedLinks) continue;

        // Add divider if this is not the first section
        if (menuItems.length > 0) {
            menuItems.push({
                sectionInfo: { section: section, className: section.className },
                item: {
                    type: "divider"
                }
            });
        }

        // Add section header
        menuItems.push({
            sectionInfo: { section: section, className: section.className },
            item: {
                type: "sectionHeader",
                sectionName: section.name,
                sectionId: sectionId
            }
        });

        // Add groups and their links
        for (let iGroup = 0; iGroup < section.groups.length; ++iGroup) {
            const group = section.groups[iGroup]!;
            const hasAuthorizedLinksInGroup = checkAuthorizedItems(group.links);
            if (!hasAuthorizedLinksInGroup) continue;

            // Add visual divider between groups (but not before the first group)
            if (iGroup > 0) {
                // Check if previous group had any authorized items to determine if we need a divider
                let prevGroupHasItems = false;
                for (let iPrevGroup = iGroup - 1; iPrevGroup >= 0; iPrevGroup--) {
                    if (checkAuthorizedItems(section.groups[iPrevGroup]!.links)) {
                        prevGroupHasItems = true;
                        break;
                    }
                }
                if (prevGroupHasItems) {
                    menuItems.push({
                        sectionInfo: { section: section, className: group.className || section.className },
                        item: {
                            type: "divider"
                        }
                    });
                }
            }

            // Add links from this group
            for (const link of group.links) {
                if (dashboardContext.isAuthorized(link.permission)) {
                    menuItems.push({
                        sectionInfo: { section: section, className: group.className || section.className },
                        item: {
                            ...link,
                            sectionId: sectionId
                        }
                    });
                }
            }
        }
    }

    return menuItems;
};

// Flatten dynamic menu items with new structure
export const FlattenDynMenuItems = (
    dashboardContext: DashboardContextData,
    items: db3.MenuLinkPayload[],
    expandedSections: Set<string>
): FlatMenuItemAndSection[] => {
    const menuItems: FlatMenuItemAndSection[] = [];
    let currentGroupName = "<never>";

    for (let iItem = 0; iItem < items.length; ++iItem) {
        const item = items[iItem]!;
        if (!dashboardContext.isAuthorizedForVisibility(item.visiblePermissionId, item.createdByUserId)) continue;
        const menuItem = DynMenuToMenuItem(item, dashboardContext);
        if (!menuItem) continue;

        const firstItemInGroup = (item.groupName !== currentGroupName);
        currentGroupName = item.groupName;
        const fakeSection: MenuSection = {
            name: currentGroupName,
            className: item.groupCssClass,
            groups: [],
        };
        const sectionId = currentGroupName || `dyn-group-${iItem}`;

        if (firstItemInGroup) {
            if (menuItems.length) {
                // add a divider because we know other items are already there.
                menuItems.push({
                    sectionInfo: { section: fakeSection, className: item.groupCssClass },
                    item: {
                        type: "divider"
                    }
                });
            }
            // add the group heading
            if (!IsNullOrWhitespace(currentGroupName)) {
                menuItems.push({
                    sectionInfo: { section: fakeSection, className: item.groupCssClass },
                    item: {
                        type: "sectionHeader",
                        sectionName: currentGroupName,
                        sectionId: sectionId
                    }
                });
            }
        }

        // Always add the item, but mark it with the parentSectionId
        menuItems.push({
            sectionInfo: { section: fakeSection, className: item.groupCssClass },
            item: {
                ...menuItem,
                sectionId: sectionId
            }
        });
    }

    return menuItems;
};

// Menu item component props
export interface MenuItemComponentProps {
    item: FlatMenuItemAndSection;
    realm: NavRealm | undefined;
    expandedSections: Set<string>;
    onToggleSection: (sectionId: string) => void;
}

// Menu item component
export const MenuItemComponent = (props: MenuItemComponentProps) => {
    const router = useRouter();
    const recordFeature = useClientTelemetryEvent();

    if (props.item.item.type === "divider") {
        return <Divider className={`${props.item.sectionInfo.className} divider`} />;
    }
    if (props.item.item.type === "sectionHeader") {
        const sectionId = props.item.item.sectionId;
        const isExpanded = props.expandedSections.has(sectionId);

        return (
            <ListSubheader
                component="div"
                onClick={() => props.onToggleSection(sectionId)}
                className={`${props.item.sectionInfo.className} sectionHeader expandable`}
                style={{ cursor: "pointer" }}
            >
                <Typography variant="button" noWrap>
                    {props.item.item.sectionName}
                </Typography>
                <div className="icon">
                    {isExpanded ? gCharMap.DownTriangle() : gCharMap.RightTriangle()}
                </div>
            </ListSubheader>
        );
    }
    if (props.item.item.type === "link") {
        const linkItem = props.item.item;
        if (linkItem.sectionId) {
            const isSectionExpanded = props.expandedSections.has(linkItem.sectionId);
            // Animate the appearance/disappearance of the links
            return (
                <Collapse in={isSectionExpanded} timeout="auto" unmountOnExit>
                    {linkItem.openInNewTab ? (
                        <ListItemButton
                            component="a"
                            href={linkItem.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`linkMenuItem ${props.item.sectionInfo.className} ${linkItem.className}`}
                            onClick={e => {
                                void recordFeature({ feature: ActivityFeature.link_follow_external });
                            }}
                        >
                            {linkItem.renderIcon && <ListItemIcon>{linkItem.renderIcon()}</ListItemIcon>}
                            <ListItemText primary={linkItem.linkCaption} />
                        </ListItemButton>
                    ) : (
                        <ListItemButton
                            component={Link}
                            href={linkItem.path}
                            selected={
                                linkItem.realm && props.realm
                                    ? linkItem.realm === props.realm
                                    : router.pathname === linkItem.path
                            }
                            className={`linkMenuItem ${props.item.sectionInfo.className} ${linkItem.className}`}
                            onClick={e => {
                                void recordFeature({ feature: ActivityFeature.link_follow_internal });
                            }}
                        >
                            {linkItem.renderIcon && <ListItemIcon>{linkItem.renderIcon()}</ListItemIcon>}
                            <ListItemText primary={linkItem.linkCaption} />
                        </ListItemButton>
                    )}
                </Collapse>
            );
        }
        // If not in a section, render as before
        const isExternal = linkItem.openInNewTab;
        const buttonContent = <>
            {linkItem.renderIcon && <ListItemIcon>{linkItem.renderIcon()}</ListItemIcon>}
            <ListItemText primary={linkItem.linkCaption} />
        </>;
        if (isExternal) {
            return (
                <ListItemButton
                    component="a"
                    href={linkItem.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`linkMenuItem ${props.item.sectionInfo.className} ${linkItem.className}`}
                    onClick={e => {
                        void recordFeature({ feature: ActivityFeature.link_follow_external });
                    }}
                >
                    {buttonContent}
                </ListItemButton>
            );
        } else {
            return (
                <ListItemButton
                    component={Link}
                    href={linkItem.path}
                    selected={router.pathname === linkItem.path}
                    className={`linkMenuItem ${props.item.sectionInfo.className} ${linkItem.className}`}
                    onClick={e => {
                        void recordFeature({ feature: ActivityFeature.link_follow_internal });
                    }}
                >
                    {buttonContent}
                </ListItemButton>
            );
        }
    }
    return <>??</>;
};

// Helper function to get menu item name for context
export const getMenuItemName = (item: FlatMenuItemSpec): string => {
    if (item.type === "link") {
        return item.linkCaption;
    }
    if (item.type === "sectionHeader") {
        return item.sectionName;
    }
    return "??";
};

// Side menu component that handles all menu logic and rendering
interface SideMenuProps {
    navRealm?: NavRealm;
    open: boolean;
    onClose: () => void;
    variant: "permanent" | "temporary";
    drawerWidth: number;
    theme: any;
}

export const SideMenu = ({ navRealm, open, onClose, variant, drawerWidth, theme }: SideMenuProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    const router = useRouter();    // Initialize expanded sections with default expanded sections
    const getInitialExpandedSections = React.useCallback(() => {
        const expanded = new Set<string>();

        // Add sections that should be expanded by default
        gMenuSections.forEach((section) => {
            if (section.expandedByDefault && section.name) {
                expanded.add(section.name);
            }
        });

        return expanded;
    }, []);

    // Find which section contains the current page and ensure it's expanded
    const getCurrentPageSection = React.useCallback(() => {
        const currentPath = router.pathname;

        // Check all sections for a matching path
        for (const section of gMenuSections) {
            for (const group of section.groups) {
                for (const link of group.links) {
                    if (link.path === currentPath) {
                        return section.name;
                    }
                }
            }
        }

        // Also check dynamic menu items if they exist
        if (dashboardContext?.dynMenuLinks?.items) {
            for (const item of dashboardContext.dynMenuLinks.items) {
                let itemPath = "";
                switch (item.linkType as keyof typeof DynMenu.DynamicMenuLinkType) {
                    case "Wiki":
                        itemPath = item.wikiSlug ? `/backstage/wiki/${slugify(item.wikiSlug)}` : "";
                        break;
                    case "ExternalURL":
                        itemPath = item.externalURI || "";
                        break;
                }
                if (itemPath === currentPath && !IsNullOrWhitespace(item.groupName)) {
                    return item.groupName;
                }
            }
        }

        return null;
    }, [router.pathname, dashboardContext]);

    const [expandedSections, setExpandedSections] = React.useState<Set<string>>(() => {
        const initial = getInitialExpandedSections();
        const currentSection = getCurrentPageSection();
        if (currentSection) {
            initial.add(currentSection);
        }
        return initial;
    });

    // Update expanded sections when the route changes
    React.useEffect(() => {
        const currentSection = getCurrentPageSection();
        if (currentSection) {
            setExpandedSections(prev => {
                const newSet = new Set(prev);
                newSet.add(currentSection);
                return newSet;
            });
        }
    }, [getCurrentPageSection]);

    const toggleSection = React.useCallback((sectionId: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    }, []);

    // flatten our list of menu sections & items based on permissions.
    const menuItems: FlatMenuItemAndSection[] = [
        ...FlattenMenuSections(dashboardContext, gMenuSections, expandedSections),
        ...FlattenDynMenuItems(dashboardContext, dashboardContext.dynMenuLinks.items, expandedSections),
    ];

    return (
        <Drawer
            sx={{
                flexShrink: 0,
                width: drawerWidth
            }}
            variant={variant}
            anchor="left"
            open={open}
            onClose={onClose}
        >
            <Box sx={{ ...theme.mixins.toolbar }} />
            <AppContextMarker name="dashboardMenu">
                <List component="nav" className="CMMenu">
                    {menuItems.map((item, index) => (
                        <AppContextMarker name={getMenuItemName(item.item)} key={index}>
                            <MenuItemComponent
                                key={index}
                                item={item}
                                realm={navRealm}
                                expandedSections={expandedSections}
                                onToggleSection={toggleSection}
                            />
                        </AppContextMarker>
                    ))}
                    <li style={{ height: 100 }}></li>{/* gives space at the bottom of the nav, which helps make things accessible if the bottom of the window is covered (e.g. snackbar message or error message is visible) */}
                </List>
            </AppContextMarker>
        </Drawer>
    );
};
