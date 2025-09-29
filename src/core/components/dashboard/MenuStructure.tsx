import { groupByMap } from '@/shared/arrayUtils';
import { Box, Collapse, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Typography } from '@mui/material';
import Link from "next/link";
import { useRouter } from "next/router";
import * as React from 'react';
import * as DynMenu from "shared/dynMenuTypes";
import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { gCharMap, gIconMap } from "../../db3/components/IconMap";
import { gNullValue } from '../../db3/shared/apiTypes';
import { AppContextMarker } from "../AppContext";
import { AdminInspectObject } from '../CMCoreComponents2';
import { DashboardContext, DashboardContextData, useClientTelemetryEvent } from "../DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { useLocalStorageSet } from "../useLocalStorageState";
import { gMenuSections, MenuLink, MenuSection, NavRealm } from './StaticMenuItems';
import { HostingMode } from '@/shared/brandConfigBase';

// NOTE: types look like this:

// the prisma schema for dynamic menu items:
// model MenuLink {
//   id        Int @id @default(autoincrement())
//   sortOrder Int @default(0)

//   realm String? @db.VarChar(768)

//   groupName     String @db.VarChar(768)
//   groupCssClass String @db.VarChar(768)

//   itemCssClass String @db.VarChar(768)
//   linkType     String @db.VarChar(768) // external, application, wiki

//   // for external, this is a URL
//   // for application, this is empty.
//   // for wiki, this is the slug
//   externalURI     String? @db.MediumText
//   applicationPage String? @db.VarChar(768) // an enum.
//   wikiSlug        String? @db.VarChar(768)

//   iconName String? @db.VarChar(768)
//   caption  String  @db.VarChar(768)

//   visiblePermissionId Int?
//   visiblePermission   Permission? @relation(fields: [visiblePermissionId], references: [id], onDelete: SetNull)
// }


// // NavRealm enum - used for navigation context
// export enum NavRealm {
//     backstageHome = "",
//     events = "events",
//     songs = "songs",
//     files = "files",
//     users = "users",
//     wikiPages = "wikiPages",
//     YourProfile = "YourProfile",
//     CustomLinks = "CustomLinks",
//     MenuLinks = "MenuLinks",
// }

// // New hierarchical menu schema types
// export interface MenuLink {
//     type: "link";
//     permission: Permission;
//     className?: string;
//     linkCaption: string;
//     path: string;
//     openInNewTab?: boolean;
//     realm?: NavRealm;
//     renderIcon: () => React.ReactNode;
// }

// // groups are separated by dividers
// export interface MenuGroup {
//     links: MenuLink[];
//     className?: string; // CSS classes for visual styling of this group
// }

// // sections have headers
// export interface MenuSection {
//     name: string;
//     className?: string;
//     expandedByDefault?: boolean;
//     groups: MenuGroup[];
// }

// // New hierarchical menu data structure
// export const gMenuSections: MenuSection[] = [
//     {
//         name: "Backstage",
//         className: "backstage",
//         expandedByDefault: true,
//         groups: [
//             {
//                 links: [
//                     { type: "link", path: "/backstage", linkCaption: "Home", renderIcon: () => <HomeIcon />, permission: Permission.login },
//                     { type: "link", path: "/backstage/events", realm: NavRealm.events, linkCaption: "Events", renderIcon: () => <CalendarMonthOutlinedIcon />, permission: Permission.view_events_nonpublic },
//                     { type: "link", path: "/backstage/songs", realm: NavRealm.songs, linkCaption: "Songs", renderIcon: () => <MusicNoteOutlinedIcon />, permission: Permission.view_songs },
//                     { type: "link", path: "/backstage/setlistPlanner", linkCaption: "Setlist Planner", renderIcon: () => <AudioFileOutlined />, permission: Permission.setlist_planner_access },
//                     { type: "link", path: "/backstage/profile", linkCaption: "Your Profile", renderIcon: () => <PersonIcon />, permission: Permission.login },
//                 ]
//             }
//         ]
//     },
//     {
//         name: "Explore",
//         groups: [
//             {
//                 links: [
//                     { type: "link", path: "/backstage/files", realm: NavRealm.files, linkCaption: "File search", renderIcon: () => gIconMap.AttachFile(), permission: Permission.access_file_landing_page },
//                     { type: "link", path: "/backstage/wikiPages", realm: NavRealm.wikiPages, linkCaption: "Wiki search", renderIcon: () => gIconMap.Article(), permission: Permission.search_wiki_pages },
//                     { type: "link", path: "/backstage/users", realm: NavRealm.users, linkCaption: "User search", renderIcon: gIconMap.Person, permission: Permission.admin_users },
//                     { type: "link", path: "/backstage/stats", linkCaption: "Event Stats", renderIcon: gIconMap.Equalizer, permission: Permission.view_events_reports },
//                     { type: "link", path: "/backstage/featureReports", linkCaption: "Feature Usage", renderIcon: () => <PieChart />, permission: Permission.view_feature_reports },
//                 ]
//             }
//         ]
//     },
// ];




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

function IsLinkEnabled(dashboardContext: DashboardContextData, link: MenuLink): boolean {
    if (link.enabledForGenericSingleTenant === false && dashboardContext.brand.hostingMode === HostingMode.GenericSingleTenant) {
        return false;
    }
    return dashboardContext.isAuthorized(link.permission);
};

// New flattening function for hierarchical menu structure
export const FlattenMenuSections = (
    dashboardContext: DashboardContextData,
    sections: MenuSection[],
    //expandedSections: Set<string>
): FlatMenuItemAndSection[] => {
    const menuItems: FlatMenuItemAndSection[] = [];

    for (let iSection = 0; iSection < sections.length; ++iSection) {
        const section = sections[iSection]!;
        const sectionId = section.name;
        //let hasAuthorizedItems = false;

        // Check if any items in this section are authorized
        const checkAuthorizedItems = (links: MenuLink[]): boolean => {
            return links.some(link => IsLinkEnabled(dashboardContext, link));
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
                if (IsLinkEnabled(dashboardContext, link)) {
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

function MenuItemMatchesRealm(linkPath: string | undefined, linkRealm: NavRealm | undefined, realm: NavRealm | undefined, router: ReturnType<typeof useRouter>): boolean {
    return linkRealm && realm
        ? linkRealm === realm
        : router.pathname === linkPath;
}

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
                            selected={MenuItemMatchesRealm(linkItem.path, linkItem.realm, props.realm, router)}
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


//type DbMenuRow = (typeof DashboardContextData)["dynMenuLinks"]//.dynMenuLinks.items[number];
const nv = (s: string | null | undefined) =>
    s === gNullValue ? "" : s || "";   // -> guaranteed empty string

export const AddDynMenuItemsToStatic = (
    staticSections: MenuSection[],
    dynSections: Map<string, Map<string, db3.DashboardDynMenuLink[]>>,
    ctx: DashboardContextData
): MenuSection[] => {
    // 1️⃣ deep‑clone static definition (so we never mutate props)
    const merged: MenuSection[] = staticSections.map(s => ({
        ...s,
        name: nv(s.name),                               // make sure no gNullValue leaked in
        groups: s.groups.map(g => ({
            ...g,
            className: nv(g.className),
            links: [...g.links],
        })),
    }));

    // 2️⃣ fold in every dynamic section / group / link
    for (const [rawSectionName, groupMap] of dynSections) {
        const sectionName = nv(rawSectionName);

        // SECTION
        let section = merged.find(s => s.name.toLowerCase() === sectionName.toLowerCase());
        if (!section) {
            section = { name: sectionName, groups: [] };
            merged.push(section);
        }

        // GROUPS
        for (const [rawGroupName, rows] of groupMap) {
            const groupName = nv(rawGroupName);

            let group = section.groups.find(g => nv(g.className).toLowerCase() === groupName.toLowerCase());
            if (!group) {
                group = { className: groupName || undefined, links: [] };
                section.groups.push(group);
            }

            // LINKS (sorted, converted, permission‑checked)
            rows
                .slice()                                     // don’t mutate DB array
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .forEach(row => {
                    const link = DynMenuToMenuItem(row, ctx);
                    if (link) group.links.push(link);
                });
        }
    }

    return merged;
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
                    const matches = MenuItemMatchesRealm(link.path, link.realm, navRealm, router);
                    if (matches) {
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

    const [expandedSections, setExpandedSections] = useLocalStorageSet(
        'menu-expanded-sections', getInitialExpandedSections
    );

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

    // TODO: fill in in dynamic menu items to the right places in the menu.
    // MenuLink.groupName specifies a section name that will house these.
    //type DbMenuRow = typeof dashboardContext.dynMenuLinks.items[number];
    const dynamicSections: Map<string, db3.DashboardDynMenuLink[]> = groupByMap(dashboardContext.dynMenuLinks.items,
        item => item.applicationPage || gNullValue, // these are section names.
    );

    // convert sections into grouped array of menu items
    const dynamicSectionsAndGroups: Map<string, Map<string, db3.DashboardDynMenuLink[]>> = new Map();
    for (const [sectionName, items] of dynamicSections.entries()) {
        const groupMap = groupByMap(items, item => item.groupName || gNullValue);
        dynamicSectionsAndGroups.set(sectionName, groupMap);
    }

    // - the db menu item section name matches section name of menu items
    //   the dyn menu items get placed at the bottom of the section
    //   if the section name is not found, it gets placed in a custom section with that name.
    // - the db menu item group name matches the group id of menu items
    // - SORTING: dyn menu items within their section & group, are sorted by sortOrder
    const menuSectionsWithDynItems = AddDynMenuItemsToStatic(
        gMenuSections,
        dynamicSectionsAndGroups,
        dashboardContext                  // extra param
    );

    // flatten our list of menu sections & items based on permissions.
    const menuItems = FlattenMenuSections(dashboardContext, menuSectionsWithDynItems);

    return (
        <Drawer
            sx={{
                flexShrink: 0,
                width: drawerWidth,
                ...(variant === "permanent" && {
                    gridArea: 'sidebar',
                    position: 'relative',
                    height: '100%', // Constrain to grid area height
                    overflow: 'hidden', // Prevent overflow
                    '& .MuiDrawer-paper': {
                        position: 'relative',
                        width: drawerWidth,
                        height: '100%',
                        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
                        boxSizing: 'border-box',
                        overflow: 'hidden', // Prevent paper overflow
                    },
                }),
            }}
            variant={variant}
            anchor="left"
            open={open}
            onClose={onClose}
        >
            {variant === "temporary" && <Box sx={{ ...theme.mixins.toolbar }} />}
            <AppContextMarker name="dashboardMenu">
                <List
                    component="nav"
                    className="CMMenu"
                    sx={variant === "permanent" ? {
                        height: '100%',
                        overflow: 'auto', // Make menu content scrollable
                        paddingBottom: '100px', // Add generous bottom padding for accessibility
                    } : {}}
                >
                    <AdminInspectObject src={menuItems} />
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
                    {variant === "temporary" && (
                        <li style={{ height: 100 }}></li>
                    )}
                </List>
            </AppContextMarker>
        </Drawer>
    );
};
