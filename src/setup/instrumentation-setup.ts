import { DefaultDbBrandConfig } from "@/shared/brandConfigBase";
import { DefaultRolePermissionAssignments, DefaultRoles } from "@/shared/defaultRolePermissionAssignments";
import { getPermissionDatabaseMetadata, gPermissionRegistry } from "@/shared/permissions";
import { Setting } from "@/shared/settingKeys";
import { assertValidSysadminRole } from "@/src/auth/server/sessionInvalidation";
import db, { Prisma } from "db";
import { SeedTable } from "./setupUtils";
import { ValidateRouteRegistry } from "../auth/shared/backstageRoutes";
import { generatePublicId } from "../server/publicId";

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
                    publicId: generatePublicId<"Permission">(),
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
    const defaultRoles: Prisma.RoleUncheckedCreateInput[] = DefaultRoles.map(role => ({
        ...role,
        publicId: generatePublicId<"Role">(),
    }));
    await SeedTable("role", db.role, defaultRoles);
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
                publicId: generatePublicId<"RolePermission">(),
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

    await SeedTable("eventStatus", db.eventStatus, eventStatuses.map(status => ({
        ...status,
        publicId: generatePublicId<"EventStatus">(),
    })));
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

    await SeedTable("eventType", db.eventType, eventTypes.map(type => ({
        ...type,
        publicId: generatePublicId<"EventType">(),
    })));
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

    await SeedTable("songCreditType", db.songCreditType, songCreditTypes.map(creditType => ({
        ...creditType,
        publicId: generatePublicId<"SongCreditType">(),
    })));
};

async function EnsureUserTags() {
    const userTags = [
        {
            "text": "Current member",
            "description": "Active member of the band",
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

    await SeedTable("userTag", db.userTag, userTags.map(tag => ({
        ...tag,
        publicId: generatePublicId<"UserTag">(),
    })));
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
    ].map(tag => ({ ...tag, publicId: generatePublicId<"FileTag">() }));

    // seed only if the table is empty
    const count = await db.fileTag.count();
    if (count > 0) {
        console.log(`File tags already exist. Skipping seeding default tags.`);
        return;
    }
    await SeedTable("fileTag", db.fileTag, fileTags);
};

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
