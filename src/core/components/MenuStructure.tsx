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
import { Box, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Typography } from '@mui/material';
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

// Menu item type definitions
export interface MenuItemDivider {
    type: "divider";
}

export interface MenuItemSectionHeader {
    type: "sectionHeader";
    sectionName: string;
    groupId?: string;
}

export interface MenuItemLink {
    type: "link";
    permission: Permission;
    className?: string;
    linkCaption: string;
    path: string;
    openInNewTab?: boolean;
    realm?: NavRealm;
    renderIcon: () => React.ReactNode;
    groupId?: string;
}

export type MenuItemSpec = MenuItemDivider | MenuItemSectionHeader | MenuItemLink;

export interface MenuItemGroup {
    name: string | null;
    className?: string;
    items: MenuItemSpec[];
    expandedByDefault?: boolean;
}

export type MenuItemAndGroup = { group: MenuItemGroup, item: MenuItemSpec };

// Menu data definitions
export const gMenuItemGroup1: MenuItemGroup[] = [
    {
        name: "Backstage",
        className: "backstage",
        expandedByDefault: true,
        items: [
            { type: "link", path: "/backstage", linkCaption: "Home", renderIcon: () => <HomeIcon />, permission: Permission.login },
            { type: "link", path: "/backstage/events", realm: NavRealm.events, linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.view_events_nonpublic },
            { type: "link", path: "/backstage/songs", realm: NavRealm.songs, linkCaption: "Songs", renderIcon: () => <MusicNoteOutlinedIcon />, permission: Permission.view_songs },
            { type: "link", path: "/backstage/setlistPlanner", linkCaption: "Setlist Planner", renderIcon: () => <AudioFileOutlined />, permission: Permission.setlist_planner_access },
            { type: "link", path: "/backstage/profile", linkCaption: "Your Profile", renderIcon: () => <PersonIcon />, permission: Permission.login },
        ],
    },
];

export const gMenuItemGroup2: MenuItemGroup[] = [
    {
        name: "Explore",
        items: [
            { type: "link", path: "/backstage/stats", linkCaption: "Stats", renderIcon: gIconMap.Equalizer, permission: Permission.view_events_nonpublic },
            { type: "link", path: "/backstage/files", realm: NavRealm.files, linkCaption: "Files", renderIcon: () => gIconMap.AttachFile(), permission: Permission.access_file_landing_page },
            { type: "link", path: "/backstage/users", realm: NavRealm.users, linkCaption: "Users", renderIcon: gIconMap.Person, permission: Permission.admin_users },
            { type: "link", path: "/backstage/wikiPages", realm: NavRealm.wikiPages, linkCaption: "Wiki pages", renderIcon: () => gIconMap.Article(), permission: Permission.view_wiki_pages },
        ],
    },
    {
        name: "Public",
        className: "public",
        items: [
            { type: "link", path: "/", linkCaption: "Homepage", renderIcon: () => gIconMap.Public(), permission: Permission.visibility_public, },
            { type: "link", path: "/backstage/frontpagegallery", linkCaption: "Homepage Photos", renderIcon: () => gIconMap.Image(), permission: Permission.edit_public_homepage },
            { type: "link", path: "/backstage/frontpageEvents", linkCaption: "Homepage Agenda", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.edit_public_homepage },
        ],
    },
    {
        name: "Configure",
        className: "backstage",
        items: [
            { type: "link", path: "/backstage/menuLinks", linkCaption: "Manage Menu Links", renderIcon: gIconMap.Settings, permission: Permission.customize_menu },
            { type: "link", path: "/backstage/customLinks", linkCaption: "Custom Links", renderIcon: gIconMap.Link, permission: Permission.view_custom_links },
            { type: "link", path: "/backstage/workflows", linkCaption: "Workflows", renderIcon: gIconMap.AccountTree, permission: Permission.view_workflow_defs },
        ],
    },
    {
        name: "Admin",
        className: "admin users",
        expandedByDefault: true,
        items: [
            { type: "link", path: "/backstage/eventImport", linkCaption: "Import events", renderIcon: gIconMap.CalendarMonth, permission: Permission.admin_events },
            { type: "link", path: "/backstage/featureReports", linkCaption: "Feature Usage", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/adminLogs", linkCaption: "Logs", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/serverHealth", linkCaption: "Server health", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/calendarPreview", linkCaption: "iCal Preview", renderIcon: () => gIconMap.CalendarMonth(), permission: Permission.sysadmin },
            { type: "link", path: "/backstage/gallery", linkCaption: "Component Gallery", renderIcon: () => <CollectionsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/colorEditor2", linkCaption: "Color Editor", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: "Admin Users",
        className: "admin users",
        items: [
            { type: "link", path: "/backstage/editUserTags", linkCaption: "Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.admin_users },
            { type: "link", path: "/backstage/roles", linkCaption: "Roles", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
            { type: "link", path: "/backstage/permissions", linkCaption: "Permissions", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
            { type: "link", path: "/backstage/rolePermissions", linkCaption: "Permission matrix", renderIcon: () => <SecurityIcon />, permission: Permission.admin_users },
        ],
    },
    {
        name: "Admin Instruments",
        className: "admin instruments",
        items: [
            { type: "link", path: "/backstage/instruments", linkCaption: "Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/userInstruments", linkCaption: "User Instruments", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: null,
        className: "admin instruments",
        items: [
            { type: "link", path: "/backstage/instrumentFunctionalGroups", linkCaption: "Functional Groups", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/instrumentTags", linkCaption: "Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
        ],
    },
    {
        name: "Admin Songs",
        className: "admin songs",
        items: [
            { type: "link", path: "/backstage/editSongs", linkCaption: "Songs", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editSongCredits", linkCaption: "Song Credits", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: null,
        className: "admin songs",
        items: [
            { type: "link", path: "/backstage/editSongTags", linkCaption: "Song Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editSongCreditTypes", linkCaption: "Credit Types", renderIcon: () => <MusicNoteIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: "Admin Events",
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEvents", linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventSegments", linkCaption: "Event Segments", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: null,
        className: "admin events",
        items: [
            { type: "link", path: "/backstage/editEventTypes", linkCaption: "Event Types", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventStatuses", linkCaption: "Event Statuses", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventTags", linkCaption: "Event Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventAttendances", linkCaption: "Attendance Options", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editEventCustomFields", linkCaption: "CustomFields", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
        ],
    },
    {
        name: "Admin Files",
        className: "admin files",
        items: [
            { type: "link", path: "/backstage/editFileTags", linkCaption: "File Tags", renderIcon: gIconMap.Tag, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editFiles", linkCaption: "Files", renderIcon: gIconMap.AttachFile, permission: Permission.sysadmin },
            { type: "link", path: "/backstage/editFrontpageGalleryItems", linkCaption: "Front page gallery", renderIcon: gIconMap.AttachFile, permission: Permission.sysadmin },
        ],
    },
    {
        name: "Admin Wiki",
        className: "admin wiki",
        items: [
            { type: "link", path: "/backstage/editWikiPageTags", linkCaption: "Wiki Page Tags", renderIcon: () => gIconMap.Tag(), permission: Permission.sysadmin },
        ],
    },
    {
        name: "Admin Settings",
        className: "admin settings",
        items: [
            { type: "link", path: "/backstage/settings", linkCaption: "Settings", renderIcon: () => <SettingsIcon />, permission: Permission.sysadmin },
        ],
    },
];

// Helper function to convert dynamic menu items to static menu items
export const DynMenuToMenuItem = (item: db3.MenuLinkPayload, dashboardContext: DashboardContextData): MenuItemLink | null => {
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

// Flatten menu groups into a single array with proper groupId assignment
export const FlattenMenuGroups = (dashboardContext: DashboardContextData, groups: MenuItemGroup[], expandedSections: Set<string>): { group: MenuItemGroup, item: MenuItemSpec }[] => {
    const menuItems: { group: MenuItemGroup, item: MenuItemSpec }[] = [];

    for (let iGroup = 0; iGroup < groups.length; ++iGroup) {
        const g = groups[iGroup]!;
        let firstItemInGroup: boolean = true;
        const groupId = g.name || `group-${iGroup}`;

        for (let iItem = 0; iItem < g.items.length; ++iItem) {
            const item = g.items[iItem] as MenuItemLink;
            assert(g.items[iItem]?.type === "link", "only link menu items should be added here; other types are created dynamically");
            if (dashboardContext.isAuthorized(item.permission)) {
                // add group header and divider if this is the first authorized item in the group
                if (firstItemInGroup) {
                    if (menuItems.length) {
                        // add a divider because we know other items are already there.
                        menuItems.push({
                            group: g,
                            item: {
                                type: "divider",
                            }
                        });
                    }
                    // add the group heading
                    if (g.name) {
                        menuItems.push({
                            group: g,
                            item: {
                                type: "sectionHeader",
                                sectionName: g.name,
                                groupId: groupId,
                            }
                        });
                    }
                    firstItemInGroup = false;
                }

                // Always add the item, but mark it with the groupId so we can filter it during rendering
                const itemWithGroupId = { ...item, groupId };
                menuItems.push({
                    group: g,
                    item: itemWithGroupId,
                });
            }
        }
    }

    return menuItems;
};

// Flatten dynamic menu items
export const FlattenDynMenuItems = (dashboardContext: DashboardContextData, items: db3.MenuLinkPayload[], expandedSections: Set<string>): { group: MenuItemGroup, item: MenuItemSpec }[] => {
    const menuItems: { group: MenuItemGroup, item: MenuItemSpec }[] = [];
    let currentGroupName = "<never>";

    for (let iItem = 0; iItem < items.length; ++iItem) {
        const item = items[iItem]!;
        if (!dashboardContext.isAuthorizedForVisibility(item.visiblePermissionId, item.createdByUserId)) continue;
        const menuItem = DynMenuToMenuItem(item, dashboardContext);
        if (!menuItem) continue;

        const firstItemInGroup = (item.groupName !== currentGroupName);
        currentGroupName = item.groupName;
        const fakeGroup: MenuItemGroup = {
            name: currentGroupName,
            className: item.groupCssClass,
            items: [],
        };
        const groupId = currentGroupName || `dyn-group-${iItem}`;

        if (firstItemInGroup) {
            if (menuItems.length) {
                // add a divider because we know other items are already there.
                menuItems.push({
                    group: fakeGroup,
                    item: {
                        type: "divider",
                    }
                });
            }
            // add the group heading
            if (!IsNullOrWhitespace(currentGroupName)) {
                menuItems.push({
                    group: fakeGroup,
                    item: {
                        type: "sectionHeader",
                        sectionName: currentGroupName,
                        groupId: groupId,
                    }
                });
            }
        }

        // Always add the item, but mark it with the groupId so we can filter it during rendering
        const menuItemWithGroupId = { ...menuItem, groupId };
        menuItems.push({
            group: fakeGroup,
            item: menuItemWithGroupId,
        });
    }

    return menuItems;
};

// Menu item component props
export interface MenuItemComponentProps {
    item: MenuItemAndGroup;
    realm: NavRealm | undefined;
    expandedSections: Set<string>;
    onToggleSection: (groupId: string) => void;
}

// Menu item component
export const MenuItemComponent = (props: MenuItemComponentProps) => {
    const router = useRouter();
    const recordFeature = useClientTelemetryEvent();

    if (props.item.item.type === "divider") {
        return <Divider className={`${props.item.group.className} divider`} />;
    }
    if (props.item.item.type === "sectionHeader") {
        const groupId = props.item.item.groupId || props.item.item.sectionName;
        const isExpanded = props.expandedSections.has(groupId);

        return (
            <ListSubheader
                component="div"
                onClick={() => props.onToggleSection(groupId)}
                className={`${props.item.group.className} sectionHeader expandable`}
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
        // Check if this link should be hidden because its section is collapsed
        const linkItem = props.item.item;
        if (linkItem.groupId) {
            const isGroupExpanded = props.expandedSections.has(linkItem.groupId);
            if (!isGroupExpanded) {
                return null; // Don't render this item if its group is collapsed
            }
        }

        // Check if the item is selected based on the current path and realm
        const item = props.item?.item;

        let selected = false;
        if (item?.realm && props.realm) {
            selected = item.realm === props.realm;
        } else if (item?.path) {
            selected = router.pathname === item.path; // safer than asPath
        }

        // Use Next.js Link for internal links, plain <a> for external
        const isExternal = props.item.item.openInNewTab;
        const buttonContent = <>
            {props.item.item.renderIcon && <ListItemIcon>{props.item.item.renderIcon()}</ListItemIcon>}
            <ListItemText primary={props.item.item.linkCaption} />
        </>;

        if (isExternal && props.item.item.type === "link") {
            // External link: open in new tab, use <a>
            const linkItem = props.item.item;
            return (
                <ListItemButton
                    component="a"
                    href={linkItem.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`linkMenuItem ${props.item.group.className} ${linkItem.className}`}
                    onClick={e => {
                        // Log activity for external link using beacon
                        void recordFeature({
                            feature: ActivityFeature.link_follow_external,
                        });
                    }}
                >
                    {buttonContent}
                </ListItemButton>
            );
        } else if (props.item.item.type === "link") {
            // Internal link: use Next.js Link for client-side navigation
            const linkItem = props.item.item;
            return (
                <ListItemButton
                    component={Link}
                    href={linkItem.path}
                    selected={selected}
                    className={`linkMenuItem ${props.item.group.className} ${linkItem.className}`}
                    onClick={e => {
                        // Log activity for internal link using beacon
                        void recordFeature({
                            feature: ActivityFeature.link_follow_internal,
                        });
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
export const getMenuItemName = (item: MenuItemSpec): string => {
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
    const router = useRouter();

    // Initialize expanded sections with default expanded groups
    const getInitialExpandedSections = React.useCallback(() => {
        const expanded = new Set<string>();

        // Add sections that should be expanded by default
        [...gMenuItemGroup1, ...gMenuItemGroup2].forEach((group, index) => {
            if (group.expandedByDefault && group.name) {
                expanded.add(group.name);
            }
        });

        return expanded;
    }, []);

    // Find which group contains the current page and ensure it's expanded
    const getCurrentPageGroup = React.useCallback(() => {
        const currentPath = router.pathname;

        // Check all groups for a matching path
        const allGroups = [...gMenuItemGroup1, ...gMenuItemGroup2];
        for (const group of allGroups) {
            if (!group.name) continue; // Skip groups without names

            for (const item of group.items) {
                if (item.type === "link" && item.path === currentPath) {
                    return group.name;
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
        const currentGroup = getCurrentPageGroup();
        if (currentGroup) {
            initial.add(currentGroup);
        }
        return initial;
    });

    // Update expanded sections when the route changes
    React.useEffect(() => {
        const currentGroup = getCurrentPageGroup();
        if (currentGroup) {
            setExpandedSections(prev => {
                const newSet = new Set(prev);
                newSet.add(currentGroup);
                return newSet;
            });
        }
    }, [getCurrentPageGroup]);

    const toggleSection = React.useCallback((groupId: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
    }, []);

    // flatten our list of menu groups & items based on permissions.
    const menuItems: { group: MenuItemGroup, item: MenuItemSpec }[] = [
        ...FlattenMenuGroups(dashboardContext, gMenuItemGroup1, expandedSections),
        ...FlattenDynMenuItems(dashboardContext, dashboardContext.dynMenuLinks.items, expandedSections),
        ...FlattenMenuGroups(dashboardContext, gMenuItemGroup2, expandedSections),
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
