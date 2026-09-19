import { DefaultDbBrandConfig } from "@/shared/brandConfigBase";
import { DefaultRolePermissionAssignments, DefaultRoles } from "@/shared/defaultRolePermissionAssignments";
import { getPermissionDatabaseMetadata, gPermissionRegistry } from "@/shared/permissions";
import { Setting } from "@/shared/settingKeys";
import { assertValidSysadminRole } from "@/src/auth/server/sessionInvalidation";
import db from "db";
import { SeedTable } from "./setupUtils";
import { ValidateRouteRegistry } from "../auth/shared/backstageRoutes";

// Ensure all permissions in code are present in the database
async function SyncPermissionsTable() {
    console.log(`Synchronizing permissions table...`);
    const dbPermissions = await db.permission.findMany();
    // ensure permissions exist.
    for (const definition of gPermissionRegistry) {
        const existingPermission = dbPermissions.find(dbp => dbp.name === definition.key);
        const canonicalData = getPermissionDatabaseMetadata(definition);

        if (existingPermission) {
            const metadataIsCurrent =
                existingPermission.description === canonicalData.description &&
                existingPermission.sortOrder === canonicalData.sortOrder &&
                existingPermission.isVisibility === canonicalData.isVisibility &&
                (!definition.presentation || (
                    existingPermission.color === definition.presentation.color &&
                    existingPermission.iconName === definition.presentation.iconName &&
                    existingPermission.significance === definition.presentation.significance
                ));
            if (metadataIsCurrent) {
                console.log(`Permission ${definition.key} and its canonical metadata already exist.`);
                continue;
            }
            await db.permission.update({
                where: { id: existingPermission.id },
                data: canonicalData,
            });
            console.log(` -> UPDATED canonical metadata for Permission ${definition.key}.`);
        } else {
            await db.permission.create({
                data: {
                    name: definition.key,
                    ...canonicalData,
                },
            });
            console.log(` -> INSERTED Permission ${definition.key}.`);
        }
    }

    // check for retired permissions in the db.
    const retiredPermissions = dbPermissions.filter(dbp => !gPermissionRegistry.some(def => def.key === dbp.name));
    for (const retired of retiredPermissions) {
        console.log(`Retired permission found in the database: ${retired.name}`);
        await db.permission.delete({
            where: { id: retired.id },
        });
        console.log(` -> DELETED retired permission ${retired.name} from the database.`);
    }
}

// ensure default roles are populated
async function EnsureDefaultRoles() {
    console.log(`Ensuring default roles...`);
    const roleCount = await db.role.count();
    console.log(`Current role count: ${roleCount}`);
    if (roleCount > 0) {
        console.log(`Roles already exist. Skipping seeding default roles.`);
        return;
    }
    await SeedTable("role", db.role, DefaultRoles);
};

async function EnsureRolePermissionMatrix() {

    // only proceed if the table is empty.
    const rpCount = await db.rolePermission.count();
    console.log(`Current role-permission assignment count: ${rpCount}`);
    if (rpCount > 0) {
        console.log(`Role-permission assignments already exist. Skipping seeding default assignments.`);
        return;
    }

    const rolePermissionAssignments = DefaultRolePermissionAssignments;

    console.log(`Seeding role-permission assignments`);
    for (let i = 0; i < rolePermissionAssignments.length; ++i) {
        const assignment = rolePermissionAssignments[i]!;
        const role = await db.role.findFirstOrThrow({
            where: { name: assignment[0] }
        });
        if (!role) {
            console.log(`Skipping assignment of permission ${assignment[1]} to role ${assignment[0]} because role doesn't exist.`);
            continue;
        }
        const permission = await db.permission.findFirstOrThrow({
            where: { name: assignment[1] }
        });
        if (!permission) {
            console.log(`Skipping assignment of permission ${assignment[1]} to role ${assignment[0]} because permission doesn't exist.`);
            continue;
        }
        const ass = await db.rolePermission.create({
            data: {
                permissionId: permission.id,
                roleId: role.id,
            }
        });
        console.log(`-> assId:${ass.id} ${role.id}(${role.name}) - ${permission.id}(${permission.name})`);
    }
}

async function EnsureEventStatuses() {
    const eventStatuses = [
        {
            "label": "New",
            "description": "The initial status for events before any confirmations or actions.",
            "sortOrder": 20,
            "color": "purple",
            "significance": "New",
            "iconName": "AutoAwesome"
        },
        {
            "label": "Checking interest",
            "description": "Nothing confirmed; let's see who's interested",
            "sortOrder": 25,
            "color": "orange",
            "significance": null,
            "iconName": "QuestionMark"
        },
        {
            "label": "Pending",
            "description": "Checking if we have enough musicians",
            "sortOrder": 30,
            "color": "red",
            "significance": null,
            "iconName": "Campaign"
        },
        {
            "label": "Finalizing",
            "description": "We have attendance, but need to finalize details before ",
            "sortOrder": 50,
            "color": "gold",
            "significance": null,
            "iconName": null
        },
        {
            "label": "Confirmed",
            "description": "The event requires no further confirmations; it's happening or has happened.",
            "sortOrder": 61,
            "color": "green",
            "significance": "FinalConfirmation",
            "iconName": "Done"
        },
        {
            "label": "Cancelled",
            "description": "The event is abandoned / cancelled. It's not happening.",
            "sortOrder": 100,
            "color": "light_gray",
            "significance": "Cancelled",
            "iconName": "Cancel"
        }
    ];

    // seed only if the table is empty
    const count = await db.eventStatus.count();
    if (count > 0) {
        console.log(`Event statuses already exist. Skipping seeding default statuses.`);
        return;
    }

    await SeedTable("eventStatus", db.eventStatus, eventStatuses);
};

async function EnsureEventTypes() {
    const eventTypes = [
        {
            "text": "Rehearsal",
            "description": "",
            "sortOrder": 50,
            "color": "light_brown",
            "significance": "Rehearsal",
            "iconName": "MusicNote"
        },
        {
            "text": "Concert",
            "description": "",
            "sortOrder": 100,
            "color": "light_blue",
            "significance": "Concert",
            "iconName": "MusicNote"
        },
        {
            "text": "Meeting",
            "description": "",
            "sortOrder": 200,
            "color": "teal",
            "significance": null,
            "iconName": "Group"
        },
        {
            "text": "Party",
            "description": "",
            "sortOrder": 220,
            "color": "light_red",
            "significance": null,
            "iconName": "Nightlife"
        }
    ];

    // seed only if the table is empty
    const count = await db.eventType.count();
    if (count > 0) {
        console.log(`Event types already exist. Skipping seeding default types.`);
        return;
    }

    await SeedTable("eventType", db.eventType, eventTypes);
};

async function EnsureEventAttendanceOptions() {

    const attendanceOptions = [
        {
            "text": "No",
            "description": "You most likely cannot join. We won't include in you in the planning.",
            "iconName": "ThumbDown",
            "color": "attendance_no",
            "sortOrder": 0,
            "strength": 0,
            "personalText": "you're not going",
            "pastText": "xyz",
            "pastPersonalText": "xyz",
            "isActive": true
        },
        {
            "text": "Probably not",
            "description": "You probably can't make it; we won't count on you for final head count or reserving things like meals",
            "iconName": "ThumbDown",
            "color": "attendance_no_maybe",
            "sortOrder": 33,
            "strength": 33,
            "personalText": "you're probably not going",
            "pastText": "snth",
            "pastPersonalText": "snth",
            "isActive": false
        },
        {
            "text": "Probably",
            "description": "We will assume you're coming, even if you're not certain you can come. We will include you for final head count and reserving things like meals.",
            "iconName": "ThumbUp",
            "color": "attendance_yes_maybe",
            "sortOrder": 66,
            "strength": 66,
            "personalText": "you're probably going",
            "pastText": "snth",
            "pastPersonalText": "snth",
            "isActive": false
        },
        {
            "text": "Yes",
            "description": "We'll plan on you being there. Please add a comment if you'll only be there partially or not sure.",
            "iconName": "ThumbUp",
            "color": "attendance_yes",
            "sortOrder": 100,
            "strength": 100,
            "personalText": "You're going!",
            "pastText": "snth",
            "pastPersonalText": "snth",
            "isActive": true
        }
    ];

    // seed only if the table is empty
    const count = await db.eventAttendance.count();
    if (count > 0) {
        console.log(`Event attendance options already exist. Skipping seeding default options.`);
        return;
    }

    await SeedTable("eventAttendance", db.eventAttendance, attendanceOptions);
}

async function EnsureSongCreditTypes() {

    const songCreditTypes = [
        {
            "text": "Composer",
            "significance": "Composer",
            "description": "",
            "sortOrder": 10,
            "color": null
        },
        {
            "text": "Arranger",
            "significance": "Arranger",
            "description": "",
            "sortOrder": 20,
            "color": null
        },
        {
            "text": "Lyrics",
            "significance": null,
            "description": "",
            "sortOrder": 40,
            "color": null
        },
        {
            "text": "Related artist",
            "significance": null,
            "description": "",
            "sortOrder": 50,
            "color": null
        }
    ];

    // seed only if the table is empty
    const count = await db.songCreditType.count();
    if (count > 0) {
        console.log(`Song credit types already exist. Skipping seeding default types.`);
        return;
    }

    await SeedTable("songCreditType", db.songCreditType, songCreditTypes);
};

async function EnsureUserTags() {
    const userTags = [
        {
            "text": "Current member",
            "description": "Current member of Café Marché",
            "sortOrder": 10,
            "color": "light_teal",
            "cssClass": null,
            "significance": "DefaultInvitation"
        },
        {
            "text": "Board",
            "description": "Default attendee of board meetings",
            "sortOrder": 20,
            "color": "light_teal",
            "cssClass": "board",
            "significance": null
        },
        {
            "text": "Director",
            "description": "Artistic/musical director",
            "sortOrder": 60,
            "color": "light_teal",
            "cssClass": "director",
            "significance": null
        },
        {
            "text": "Guest",
            "description": "A non-member",
            "sortOrder": 70,
            "color": "light_gray",
            "cssClass": "guest",
            "significance": null
        }
    ];

    // seed only if the table is empty
    const count = await db.userTag.count();
    if (count > 0) {
        console.log(`User tags already exist. Skipping seeding default tags.`);
        return;
    }

    await SeedTable("userTag", db.userTag, userTags);
};

async function EnsureFileTags() {
    const fileTags = [
        {
            "text": "Partition",
            "description": "",
            "sortOrder": 15,
            "color": null,
            "significance": "Partition"
        },
        {
            "text": "in C",
            "description": "Concert key, not transposed",
            "sortOrder": 59,
            "color": "light_teal",
            "significance": null
        },
        {
            "text": "In B♭",
            "description": "Transposed for Trumpets, Tenor sax, clarinet ...",
            "sortOrder": 60,
            "color": "light_teal",
            "significance": null
        },
        {
            "text": "In E♭",
            "description": "Transposed for Alto Horn, Alto Sax, Bari Sax...",
            "sortOrder": 61,
            "color": "light_teal",
            "significance": null
        },
        {
            "text": "Recording",
            "description": "",
            "sortOrder": 79,
            "color": null,
            "significance": "Recording"
        },
        {
            "text": "Rider",
            "description": "",
            "sortOrder": 100,
            "color": null,
            "significance": "Rider"
        },
    ];

    // seed only if the table is empty
    const count = await db.fileTag.count();
    if (count > 0) {
        console.log(`File tags already exist. Skipping seeding default tags.`);
        return;
    }
    await SeedTable("fileTag", db.fileTag, fileTags);
};

// async function InitSettings() {
//     const settings = [
//         {
//             "name": "customLink.redirectType.DescriptionMarkdown",
//             "value": "Use \"Temporary\" normally; the standard HTTP 302 redirect. This will redirect users immediately from the web server, in a transparent way.\n\n\"Disabled\" to disable this redirect.\n\n\"Client\" redirects users as if they clicked on a link from this website. The destination will see that they were referred from this website, but the advantage is hash anchors (\"#anchor\") in URLs are preserved.\n\n\"Intermediate Page\" will show a page to the user which lets them click a link before redirecting to the new URL."
//         },
//         {
//             "name": "CustomLinkRedirectTypeDescriptionMarkdown_Temporary",
//             "value": "Standard HTTP 302 redirect. Use this by default. This will redirect users immediately from the web server, in a transparent way."
//         },
//         {
//             "name": "CustomLinksPageMarkdown",
//             "value": "Here we can configure links to to external resources from the cafemarche.be domain. For example we can make https://cafemarche.be/mylink redirect users to a document or dropbox folder.\n\nWarning! Google doc and dropbox URLs are purposely long and cryptic, so they cannot be guessed or automatically discovered / crawled by hackers etc. Please avoid linking to private things this way."
//         },
//         {
//             "name": "DashboardStats_SongsMarkdown",
//             "value": "This shows \"current\" songs, appearing in upcoming or very recent events."
//         },
//         {
//             "name": "EditUserTagsPage_markdown",
//             "value": "User tags are functionally used for inviting to events. These are not like user roles (which are technical); these are like being members of some group. For example board, musician, etc.\n\nWorkgroups therefore can create a user tag and that's a way of making people a member of that group. (TODO: a way of seeing people of a certain tag?)"
//         },
//         {
//             "name": "event.expectedAttendanceUserTag.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "event.status.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "Event.tags.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "event.type.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "event.visiblePermission.DescriptionMarkdown",
//             "value": "In order to appear on the public homepage agenda, this needs to be `visibility_public`. Otherwise for more private events like CM Weekend, this can be `visibility_members`"
//         },
//         {
//             "name": "event.visiblePermission.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "Event.workflowDef.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "EventSegment",
//             "value": "The time span for this segment. \"TBD\" = \"To be decided\""
//         },
//         {
//             "name": "EventSegment.description.DescriptionMarkdown",
//             "value": "Normally this should not be set. It's only used to indicate which choice was selected, for example [[event:97|Winterconcert 2025 (Fri Feb 28 2025)]], the chosen weekend is set to \"confirmed\", and the options which were not chosen are marked \"cancelled\".\n\nFor all other events, this field is not set, and you should use the status for the event itself (not the event segment)"
//         },
//         {
//             "name": "EventSegment.status.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "eventSegmentUserResponse.attendance.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "File.visiblePermission.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "InstrumentFunctionalGroupList_markdown",
//             "value": "Mostly, \"instruments\" and \"instrument functional groups\" will be a 1:1 map. But there may be cases when multiple instruments serve the same purpose in a performance or arrangement, so they can share a functional group. Think \"bass guitar\" and \"contrabass\", or \"melodica\" and \"accordion\"."
//         },
//         {
//             "name": "instrumentList_markdown",
//             "value": "\"Instruments\" are taggable. So if a user identifies with an instrument, it should be here.\n\nMost importantly: if **files** are taggable with an instrument, it should be here. For example if there are separate \"Trumpet in Bb\" and \"Trumpet in C\" parts, there should be separate Bb and C instruments."
//         },
//         {
//             "name": "menuLink.caption.DescriptionMarkdown",
//             "value": "The text that's displayed on the menu."
//         },
//         {
//             "name": "menuLink.externalURI.DescriptionMarkdown",
//             "value": "This is used when \"Type\" is \"External URL\""
//         },
//         {
//             "name": "menuLink.groupCssClass.DescriptionMarkdown",
//             "value": "Technical field which may contain special formatting / coloring. Leave blank."
//         },
//         {
//             "name": "menuLink.groupName.DescriptionMarkdown",
//             "value": "Links can be grouped together by name. Groups have a line separator. You may leave this blank to add it to the existing \"Backstage\" menu item group."
//         },
//         {
//             "name": "menuLink.iconName.DescriptionMarkdown",
//             "value": "Menu items have icons; select here."
//         },
//         {
//             "name": "menuLink.itemCssClass.DescriptionMarkdown",
//             "value": "Technical field which may contain special formatting / coloring. Leave blank."
//         },
//         {
//             "name": "menuLink.linkType.DescriptionMarkdown",
//             "value": "* External URL: link to an external resource; will open in a new tab.\n* Wiki: link to a wiki page on this website."
//         },
//         {
//             "name": "menuLink.visiblePermission.DescriptionMarkdown",
//             "value": "Who will be able to view this link? Typically this will be \"members\", who have been given permissions as normal users."
//         },
//         {
//             "name": "MenuLink.visiblePermission.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "menuLink.wikiSlug.DescriptionMarkdown",
//             "value": "For wiki menu item types, this is the \"slug\" of the wiki page."
//         },
//         {
//             "name": "MenuLinksPageMarkdown",
//             "value": "Here we can customize the links on the left-side menu. This will serve 2 main functions:\n\n1. Link to external resources like Google drive or Dropbox\n2. Link to wiki pages. This is the only way users will access the wiki.\n"
//         },
//         {
//             "name": "NewEventSegmentDialogDescription",
//             "value": "\"Segments\" are subdivisions of events, so people can specify they're coming only to a part of the show. For example the Weekend this could be one \"segment\" per day. Or for a concert with multiple sets. For simplicity, only create more segments when it's important to know if people can only attend for part of the event."
//         },
//         {
//             "name": "NewEventSegmentDialogTitle",
//             "value": "Edit event segment"
//         },
//         {
//             "name": "RolesAdminPage_markdown",
//             "value": "User roles are technical roles for accessing features of the website. Default public users are `Limited Users`, and an admin can elevate them to `Normal Users` who have the most general-purpose access to the site. `Editors` can create items like events\n\nSee the permission matrix for an overview of permission mappings."
//         },
//         {
//             "name": "Song.tags.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "Song.visiblePermission.DescriptionMarkdown",
//             "value": "This should always be `visibility_members`; I can't think of any reason to change this setting. Maybe `Private` can be used for testing or playing around without other people seeing what you're doing. But the other settings should never be used."
//         },
//         {
//             "name": "Song.visiblePermission.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "songCredit.type.SelectStyle",
//             "value": "inline"
//         },
//         {
//             "name": "user.role.SelectStyle",
//             "value": "inline"
//         }
//     ];

//     // seed only if the table is empty
//     const count = await db.setting.count();
//     if (count > 0) {
//         console.log(`Settings already exist. Skipping seeding default settings.`);
//         return;
//     }
//     await SeedTable("setting", db.setting, settings);
// }

export async function instrumentationSetup() {

    await ValidateRouteRegistry();

    await SyncPermissionsTable();
    await EnsureDefaultRoles();

    await EnsureRolePermissionMatrix();

    await assertValidSysadminRole(db);
    await EnsureEventStatuses();
    await EnsureEventTypes();
    await EnsureEventAttendanceOptions();
    await EnsureSongCreditTypes();
    await EnsureUserTags();
    await EnsureFileTags();
    await EnsureBrandingDefaults();
}

// Ensure Dashboard_* branding settings are present with sensible defaults.
// We only CREATE missing keys; existing values are never overwritten.
async function EnsureBrandingDefaults() {
    console.log("Ensuring branding default settings...");

    // Build desired settings list from DefaultDbBrandConfig
    const desired: { name: string; value: string }[] = [
        { name: Setting.Dashboard_SiteTitle, value: DefaultDbBrandConfig.siteTitle },
        { name: Setting.Dashboard_SiteTitlePrefix, value: DefaultDbBrandConfig.siteTitlePrefix },
        { name: Setting.Dashboard_SiteFaviconUrl, value: DefaultDbBrandConfig.siteFaviconUrl },
    ];
    if (DefaultDbBrandConfig.siteLogoUrl) desired.push({ name: Setting.Dashboard_SiteLogoUrl, value: DefaultDbBrandConfig.siteLogoUrl });

    // Theme values (optional)
    if (DefaultDbBrandConfig.theme?.primaryMain) desired.push({ name: Setting.Dashboard_Theme_PrimaryMain, value: DefaultDbBrandConfig.theme.primaryMain });
    if (DefaultDbBrandConfig.theme?.secondaryMain) desired.push({ name: Setting.Dashboard_Theme_SecondaryMain, value: DefaultDbBrandConfig.theme.secondaryMain });
    if (DefaultDbBrandConfig.theme?.backgroundDefault) desired.push({ name: Setting.Dashboard_Theme_BackgroundDefault, value: DefaultDbBrandConfig.theme.backgroundDefault });
    if (DefaultDbBrandConfig.theme?.backgroundPaper) desired.push({ name: Setting.Dashboard_Theme_BackgroundPaper, value: DefaultDbBrandConfig.theme.backgroundPaper });
    if (DefaultDbBrandConfig.theme?.contrastText) desired.push({ name: Setting.Dashboard_Theme_ContrastText, value: DefaultDbBrandConfig.theme.contrastText });
    if (DefaultDbBrandConfig.theme?.textPrimary) desired.push({ name: Setting.Dashboard_Theme_TextPrimary, value: DefaultDbBrandConfig.theme.textPrimary });

    const names = desired.map(d => d.name);
    const existing = await db.setting.findMany({ where: { name: { in: names } } });
    const existingSet = new Set(existing.map(s => s.name));
    const toCreate = desired.filter(d => !existingSet.has(d.name));

    if (toCreate.length === 0) {
        console.log("Branding settings already present. Skipping insert.");
        return;
    }

    await SeedTable("setting", db.setting, toCreate);
}
