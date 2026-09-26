import db from "db"
import { execSync } from "child_process";
import { nanoid } from "nanoid";
import { instrumentationSetup } from "./setup/instrumentation-setup";
import { PublicIdRepairDelegate, repairPublicIdPlaceholders } from "./server/publicId";
import { QuickSearchItemType } from "shared/quickFilter";

type GitVersionInfo = {
    versionTag: string;
    commitsSinceTag: number;
    isDirty: boolean;
    revision: string;
    commitDate: string;
};

const readGitVersionInfo = (): GitVersionInfo => {
    const revision = execSync('git rev-parse HEAD').toString().trim();
    const commitDate = execSync('git log -1 --format=%cd').toString().trim();
    const versionTag = execSync('git describe --tags --abbrev=0 --always').toString().trim();
    const commitsSinceTagRaw = execSync(`git rev-list ${versionTag}..HEAD --count`).toString().trim();
    const commitsSinceTag = Number.parseInt(commitsSinceTagRaw, 10);
    const isDirty = execSync('git status --porcelain').toString().trim().length > 0;

    return {
        versionTag,
        commitsSinceTag: Number.isFinite(commitsSinceTag) ? commitsSinceTag : 0,
        isDirty,
        revision,
        commitDate,
    };
};

async function CorrectUserUids() {
    // ensure users have uids populated
    // Intentional read-policy bypass: startup data repair covers active and
    // soft-deleted users and has no request actor.
    const usersWithoutUid = await db.user.findMany({
        where: {
            uid: null,
        },
    })

    console.log(`Users with NULL UIDs: ${usersWithoutUid.length}`);

    // Update each user, setting a new UUID for their uid field
    const updates = usersWithoutUid.map(async (user) => {
        return await db.user.update({
            where: {
                id: user.id,
            },
            data: {
                uid: nanoid(),
            },
        })
    });

    const ups = await Promise.all(updates);

    for (const up of ups) {
        console.log(`-> #${up.id} (${up.name}) => ${up.uid}`);
    }
};

async function CorrectEventSegmentUids() {
    const segmentsWithoutUid = await db.eventSegment.findMany({
        where: {
            uid: null,
        },
    })

    console.log(`Event Segments with NULL UIDs: ${segmentsWithoutUid.length}`);

    // Update each user, setting a new UUID for their uid field
    const updates = segmentsWithoutUid.map(async (seg) => {
        return await db.eventSegment.update({
            where: {
                id: seg.id,
            },
            data: {
                uid: nanoid(),
            },
        })
    });

    const ups = await Promise.all(updates);

    for (const up of ups) {
        console.log(`-> #${up.id} (${up.id}) => ${up.uid}`);
    }
};

async function CorrectPublicIds(delegate: PublicIdRepairDelegate, modelName: string) {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate,
        modelName,
    });
    console.log(`Replaced ${replacementCount} ${modelName} public-ID placeholders.`);
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === "object" && value !== null && !Array.isArray(value)
);

const getSetlistPlanAssociatedItems = (payload: unknown): Record<string, unknown>[] => {
    if (!isRecord(payload)) return [];
    const associatedItems: Record<string, unknown>[] = [];
    for (const collectionName of ["columns", "columnLeds", "rowLeds"] as const) {
        const collection = payload[collectionName];
        if (!Array.isArray(collection)) continue;
        for (const entry of collection) {
            if (!isRecord(entry) || !isRecord(entry.associatedItem)) continue;
            associatedItems.push(entry.associatedItem);
        }
    }
    return associatedItems;
};

const getSetlistPlanRows = (payload: unknown): Record<string, unknown>[] => (
    isRecord(payload) && Array.isArray(payload.rows) ? payload.rows.filter(isRecord) : []
);

export async function MigrateEventDescriptionWikiPaths() {
    const describedEvents = await db.event.findMany({
        where: { descriptionWikiPageId: { not: null } },
        select: {
            publicId: true,
            descriptionWikiPage: { select: { id: true, slug: true, namespace: true } },
        },
    });

    // update wiki slugs to match the new ID
    // used to be EventDescription/1234
    // now it needs to be EventDescription/<publicId>
    let migratedWikiPages = 0;
    for (const event of describedEvents) {
        if (!event.descriptionWikiPage) continue;
        const slug = `EventDescription/${event.publicId}`;
        if (event.descriptionWikiPage.slug === slug
            && event.descriptionWikiPage.namespace === "EventDescription") continue;
        await db.wikiPage.update({
            where: { id: event.descriptionWikiPage.id },
            data: { slug, namespace: "EventDescription" },
        });
        migratedWikiPages++;
    }

    console.log(`Migrated ${migratedWikiPages} Event-description wiki paths.`);
}

type SetlistPlanPublicIds = {
    event: ReadonlyMap<number, string>;
    song: ReadonlyMap<number, string>;
};

export async function MigrateSetlistPlanPublicIdReferences() {
    const plans = await db.setlistPlan.findMany({ select: { id: true, payloadJson: true } });
    const parsedPlans: { id: number; payload: unknown }[] = [];
    const numericEventIds = new Set<number>();
    const numericSongIds = new Set<number>();
    for (const plan of plans) {
        try {
            const payload: unknown = JSON.parse(plan.payloadJson);
            for (const row of getSetlistPlanRows(payload)) {
                if (typeof row.songId === "number") numericSongIds.add(row.songId);
            }
            for (const item of getSetlistPlanAssociatedItems(payload)) {
                if (item.itemType === QuickSearchItemType.event && typeof item.id === "number") {
                    numericEventIds.add(item.id);
                }
                if (item.itemType === QuickSearchItemType.song && typeof item.id === "number") {
                    numericSongIds.add(item.id);
                }
            }
            parsedPlans.push({ id: plan.id, payload });
        } catch {
            console.warn(`SetlistPlan #${plan.id} has invalid JSON; its references were not migrated.`);
        }
    }

    const events = numericEventIds.size === 0
        ? []
        : await db.event.findMany({
            where: { id: { in: [...numericEventIds] } },
            select: { id: true, publicId: true },
        });
    const songs = numericSongIds.size === 0
        ? []
        : await db.song.findMany({
            where: { id: { in: [...numericSongIds] } },
            select: { id: true, publicId: true },
        });
    const publicIds: SetlistPlanPublicIds = {
        event: new Map(events.map(event => [event.id, event.publicId])),
        song: new Map(songs.map(song => [song.id, song.publicId])),
    };
    let migratedPlans = 0;
    for (const plan of parsedPlans) {
        if (!migrateSetlistPlanReferences(plan.payload, publicIds)) continue;
        await db.setlistPlan.update({
            where: { id: plan.id },
            data: { payloadJson: JSON.stringify(plan.payload) },
        });
        migratedPlans++;
    }
    console.log(`Migrated public ID references in ${migratedPlans} SetlistPlan records.`);
}

export function migrateSetlistPlanReferences(
    payload: unknown,
    publicIds: SetlistPlanPublicIds,
): boolean {
    let changed = false;
    for (const row of getSetlistPlanRows(payload)) {
        if (typeof row.songId !== "number") continue;
        const publicId = publicIds.song.get(row.songId);
        if (!publicId) continue;
        row.songId = publicId;
        changed = true;
    }
    for (const item of getSetlistPlanAssociatedItems(payload)) {
        if (typeof item.id !== "number") continue;
        const isEvent = item.itemType === QuickSearchItemType.event;
        const isSong = item.itemType === QuickSearchItemType.song;
        if (!isEvent && !isSong) continue;
        const publicId = (isEvent ? publicIds.event : publicIds.song).get(item.id);
        if (!publicId) continue;
        item.id = publicId;
        if (typeof item.absoluteUri === "string") {
            item.absoluteUri = item.absoluteUri.replace(
                isEvent ? /\/backstage\/event\/\d+(?=\/|$)/ : /\/backstage\/song\/\d+(?=\/|$)/,
                `/backstage/${isEvent ? "event" : "song"}/${publicId}`,
            );
        }
        changed = true;
    }
    return changed;
}

export async function registerNodeInstrumentation() {
    console.log(`INSTRUMENTATION RUNNING`);
    await instrumentationSetup();

    await CorrectUserUids();
    await CorrectEventSegmentUids();

    // public id corrections    
    await CorrectPublicIds(db.instrumentFunctionalGroup, "InstrumentFunctionalGroup");
    await CorrectPublicIds(db.instrument, "Instrument");
    await CorrectPublicIds(db.instrumentTag, "InstrumentTag");
    await CorrectPublicIds(db.instrumentTagAssociation, "InstrumentTagAssociation");
    await CorrectPublicIds(db.songTag, "SongTag");
    await CorrectPublicIds(db.songTagAssociation, "SongTagAssociation");
    await CorrectPublicIds(db.song, "Song");
    await CorrectPublicIds(db.file, "File");
    await CorrectPublicIds(db.frontpageGalleryItem, "FrontpageGalleryItem");
    await CorrectPublicIds(db.songCreditType, "SongCreditType");
    await CorrectPublicIds(db.songCredit, "SongCredit");
    await CorrectPublicIds(db.fileTag, "FileTag");
    await CorrectPublicIds(db.fileTagAssignment, "FileTagAssignment");
    await CorrectPublicIds(db.wikiPageTag, "WikiPageTag");
    await CorrectPublicIds(db.wikiPageTagAssignment, "WikiPageTagAssignment");
    await CorrectPublicIds(db.eventType, "EventType");
    await CorrectPublicIds(db.eventStatus, "EventStatus");
    await CorrectPublicIds(db.eventTag, "EventTag");
    await CorrectPublicIds(db.eventTagAssignment, "EventTagAssignment");
    await CorrectPublicIds(db.userTag, "UserTag");
    await CorrectPublicIds(db.userTagAssignment, "UserTagAssignment");
    await CorrectPublicIds(db.userInstrument, "UserInstrument");
    await CorrectPublicIds(db.fileUserTag, "FileUserTag");
    await CorrectPublicIds(db.fileSongTag, "FileSongTag");
    await CorrectPublicIds(db.fileEventTag, "FileEventTag");
    await CorrectPublicIds(db.fileInstrumentTag, "FileInstrumentTag");
    await CorrectPublicIds(db.fileWikiPageTag, "FileWikiPageTag");
    await CorrectPublicIds(db.permission, "Permission");
    await CorrectPublicIds(db.role, "Role");
    await CorrectPublicIds(db.rolePermission, "RolePermission");
    await CorrectPublicIds(db.userSignInMethod, "UserSignInMethod");
    await CorrectPublicIds(db.event, "Event");
    await CorrectPublicIds(db.eventSegment, "EventSegment");
    await CorrectPublicIds(db.eventUserResponse, "EventUserResponse");
    await CorrectPublicIds(db.eventSegmentUserResponse, "EventSegmentUserResponse");
    await CorrectPublicIds(db.eventAttendance, "EventAttendance");
    await CorrectPublicIds(db.eventSongList, "EventSongList");
    await CorrectPublicIds(db.eventSongListSong, "EventSongListSong");
    await CorrectPublicIds(db.eventSongListDivider, "EventSongListDivider");

    await MigrateEventDescriptionWikiPaths();
    await MigrateSetlistPlanPublicIdReferences();

    //const startupState = getServerStartStateRef();
    process.env.CMDB_START_TIME = `${new Date().valueOf()}`;
    const gitVersionInfo = readGitVersionInfo();

    process.env.CMDB_GIT_REVISION = gitVersionInfo.revision;
    process.env.CMDB_GIT_COMMIT_DATE = gitVersionInfo.commitDate;
    process.env.CMDB_VERSION_TAG = gitVersionInfo.versionTag;
    process.env.CMDB_VERSION_COMMITS_SINCE_TAG = `${gitVersionInfo.commitsSinceTag}`;
    process.env.CMDB_VERSION_IS_DIRTY = gitVersionInfo.isDirty ? "true" : "false";
    process.env.CMDB_GIT_IS_DIRTY = process.env.CMDB_VERSION_IS_DIRTY;
    process.env.CMDB_GIT_TAG = gitVersionInfo.versionTag;

    console.log(`process.env.CMDB_START_TIME = ${process.env.CMDB_START_TIME}`);
    console.log(`process.env.CMDB_GIT_REVISION = ${process.env.CMDB_GIT_REVISION}`);
    console.log(`process.env.CMDB_GIT_COMMIT_DATE = ${process.env.CMDB_GIT_COMMIT_DATE}`);
    console.log(`process.env.CMDB_VERSION_TAG = ${process.env.CMDB_VERSION_TAG}`);
    console.log(`process.env.CMDB_VERSION_COMMITS_SINCE_TAG = ${process.env.CMDB_VERSION_COMMITS_SINCE_TAG}`);
    console.log(`process.env.CMDB_VERSION_IS_DIRTY = ${process.env.CMDB_VERSION_IS_DIRTY}`);
}
