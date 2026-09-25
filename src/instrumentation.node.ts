import db from "db"
import { execSync } from "child_process";
import { nanoid } from "nanoid";
import { instrumentationSetup } from "./setup/instrumentation-setup";
import { repairPublicIdPlaceholders } from "./server/publicId";
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

export async function CorrectInstrumentFunctionalGroupPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.instrumentFunctionalGroup,
        modelName: "InstrumentFunctionalGroup",
    });
    console.log(`Replaced ${replacementCount} InstrumentFunctionalGroup public-ID placeholders.`);
}

export async function CorrectInstrumentTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.instrumentTag,
        modelName: "InstrumentTag",
    });
    console.log(`Replaced ${replacementCount} InstrumentTag public-ID placeholders.`);
}

export async function CorrectInstrumentTagAssociationPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.instrumentTagAssociation,
        modelName: "InstrumentTagAssociation",
    });
    console.log(`Replaced ${replacementCount} InstrumentTagAssociation public-ID placeholders.`);
}

export async function CorrectInstrumentPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.instrument,
        modelName: "Instrument",
    });
    console.log(`Replaced ${replacementCount} Instrument public-ID placeholders.`);
}

export async function CorrectSongTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.songTag,
        modelName: "SongTag",
    });
    console.log(`Replaced ${replacementCount} SongTag public-ID placeholders.`);
}

export async function CorrectSongTagAssociationPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.songTagAssociation,
        modelName: "SongTagAssociation",
    });
    console.log(`Replaced ${replacementCount} SongTagAssociation public-ID placeholders.`);
}

export async function CorrectSongCreditTypePublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.songCreditType,
        modelName: "SongCreditType",
    });
    console.log(`Replaced ${replacementCount} SongCreditType public-ID placeholders.`);
}

export async function CorrectSongCreditPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.songCredit,
        modelName: "SongCredit",
    });
    console.log(`Replaced ${replacementCount} SongCredit public-ID placeholders.`);
}

export async function CorrectFileTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.fileTag,
        modelName: "FileTag",
    });
    console.log(`Replaced ${replacementCount} FileTag public-ID placeholders.`);
}

export async function CorrectFileTagAssignmentPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.fileTagAssignment,
        modelName: "FileTagAssignment",
    });
    console.log(`Replaced ${replacementCount} FileTagAssignment public-ID placeholders.`);
}

export async function CorrectWikiPageTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.wikiPageTag,
        modelName: "WikiPageTag",
    });
    console.log(`Replaced ${replacementCount} WikiPageTag public-ID placeholders.`);
}

export async function CorrectWikiPageTagAssignmentPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.wikiPageTagAssignment,
        modelName: "WikiPageTagAssignment",
    });
    console.log(`Replaced ${replacementCount} WikiPageTagAssignment public-ID placeholders.`);
}

export async function CorrectEventTypePublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventType,
        modelName: "EventType",
    });
    console.log(`Replaced ${replacementCount} EventType public-ID placeholders.`);
}

export async function CorrectEventStatusPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventStatus,
        modelName: "EventStatus",
    });
    console.log(`Replaced ${replacementCount} EventStatus public-ID placeholders.`);
}

export async function CorrectEventTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventTag,
        modelName: "EventTag",
    });
    console.log(`Replaced ${replacementCount} EventTag public-ID placeholders.`);
}

export async function CorrectEventTagAssignmentPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventTagAssignment,
        modelName: "EventTagAssignment",
    });
    console.log(`Replaced ${replacementCount} EventTagAssignment public-ID placeholders.`);
}

export async function CorrectUserTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.userTag,
        modelName: "UserTag",
    });
    console.log(`Replaced ${replacementCount} UserTag public-ID placeholders.`);
}

export async function CorrectUserTagAssignmentPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.userTagAssignment,
        modelName: "UserTagAssignment",
    });
    console.log(`Replaced ${replacementCount} UserTagAssignment public-ID placeholders.`);
}

export async function CorrectUserInstrumentPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.userInstrument,
        modelName: "UserInstrument",
    });
    console.log(`Replaced ${replacementCount} UserInstrument public-ID placeholders.`);
}

export async function CorrectFileUserTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.fileUserTag,
        modelName: "FileUserTag",
    });
    console.log(`Replaced ${replacementCount} FileUserTag public-ID placeholders.`);
}

export async function CorrectFileSongTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.fileSongTag,
        modelName: "FileSongTag",
    });
    console.log(`Replaced ${replacementCount} FileSongTag public-ID placeholders.`);
}

export async function CorrectFileEventTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.fileEventTag,
        modelName: "FileEventTag",
    });
    console.log(`Replaced ${replacementCount} FileEventTag public-ID placeholders.`);
}

export async function CorrectFileInstrumentTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.fileInstrumentTag,
        modelName: "FileInstrumentTag",
    });
    console.log(`Replaced ${replacementCount} FileInstrumentTag public-ID placeholders.`);
}

export async function CorrectFileWikiPageTagPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.fileWikiPageTag,
        modelName: "FileWikiPageTag",
    });
    console.log(`Replaced ${replacementCount} FileWikiPageTag public-ID placeholders.`);
}

export async function CorrectPermissionPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.permission,
        modelName: "Permission",
    });
    console.log(`Replaced ${replacementCount} Permission public-ID placeholders.`);
}

export async function CorrectRolePublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.role,
        modelName: "Role",
    });
    console.log(`Replaced ${replacementCount} Role public-ID placeholders.`);
}

export async function CorrectRolePermissionPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.rolePermission,
        modelName: "RolePermission",
    });
    console.log(`Replaced ${replacementCount} RolePermission public-ID placeholders.`);
}

export async function CorrectEventPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.event, modelName: "Event",
    });
    console.log(`Replaced ${replacementCount} Event public-ID placeholders.`);
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

export async function MigrateEventPublicIdReferences() {
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

    // setlist plans
    const plans = await db.setlistPlan.findMany({ select: { id: true, payloadJson: true } });
    const parsedPlans: { id: number; payload: unknown; associatedItems: Record<string, unknown>[] }[] = [];
    const numericEventIds = new Set<number>();
    for (const plan of plans) {
        try {
            const payload: unknown = JSON.parse(plan.payloadJson);
            const associatedItems = getSetlistPlanAssociatedItems(payload);
            for (const item of associatedItems) {
                if (item.itemType === QuickSearchItemType.event && typeof item.id === "number") {
                    numericEventIds.add(item.id);
                }
            }
            parsedPlans.push({ id: plan.id, payload, associatedItems });
        } catch {
            console.warn(`SetlistPlan #${plan.id} has invalid JSON; its Event references were not migrated.`);
        }
    }

    const events = numericEventIds.size === 0
        ? []
        : await db.event.findMany({
            where: { id: { in: [...numericEventIds] } },
            select: { id: true, publicId: true },
        });
    const publicIdByNumericId = new Map(events.map(event => [event.id, event.publicId]));
    let migratedSetlistPlans = 0;
    for (const plan of parsedPlans) {
        let changed = false;
        for (const item of plan.associatedItems) {
            if (item.itemType !== QuickSearchItemType.event || typeof item.id !== "number") continue;
            const publicId = publicIdByNumericId.get(item.id);
            if (!publicId) continue;
            item.id = publicId;
            if (typeof item.absoluteUri === "string") {
                item.absoluteUri = item.absoluteUri.replace(
                    /\/backstage\/event\/\d+(?=\/|$)/,
                    `/backstage/event/${publicId}`,
                );
            }
            changed = true;
        }
        if (!changed) continue;
        await db.setlistPlan.update({
            where: { id: plan.id },
            data: { payloadJson: JSON.stringify(plan.payload) },
        });
        migratedSetlistPlans++;
    }

    console.log(`Migrated ${migratedWikiPages} Event-description wiki paths and ${migratedSetlistPlans} SetlistPlan Event references.`);
}

export async function CorrectEventSegmentPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventSegment, modelName: "EventSegment",
    });
    console.log(`Replaced ${replacementCount} EventSegment public-ID placeholders.`);
}

export async function CorrectEventUserResponsePublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventUserResponse, modelName: "EventUserResponse",
    });
    console.log(`Replaced ${replacementCount} EventUserResponse public-ID placeholders.`);
}

export async function CorrectEventSegmentUserResponsePublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventSegmentUserResponse, modelName: "EventSegmentUserResponse",
    });
    console.log(`Replaced ${replacementCount} EventSegmentUserResponse public-ID placeholders.`);
}

export async function CorrectEventAttendancePublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({ delegate: db.eventAttendance, modelName: "EventAttendance" });
    console.log(`Replaced ${replacementCount} EventAttendance public-ID placeholders.`);
}

export async function CorrectEventSongListPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventSongList,
        modelName: "EventSongList",
    });
    console.log(`Replaced ${replacementCount} EventSongList public-ID placeholders.`);
}

export async function CorrectEventSongListSongPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventSongListSong,
        modelName: "EventSongListSong",
    });
    console.log(`Replaced ${replacementCount} EventSongListSong public-ID placeholders.`);
}

export async function CorrectEventSongListDividerPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.eventSongListDivider,
        modelName: "EventSongListDivider",
    });
    console.log(`Replaced ${replacementCount} EventSongListDivider public-ID placeholders.`);
}

export async function CorrectUserSignInMethodPublicIds() {
    const replacementCount = await repairPublicIdPlaceholders({
        delegate: db.userSignInMethod,
        modelName: "UserSignInMethod",
    });
    console.log(`Replaced ${replacementCount} UserSignInMethod public-ID placeholders.`);
}

export async function registerNodeInstrumentation() {
    console.log(`INSTRUMENTATION RUNNING`);
    await instrumentationSetup();

    await CorrectUserUids();
    await CorrectEventSegmentUids();

    // public id corrections
    await CorrectInstrumentFunctionalGroupPublicIds();
    await CorrectInstrumentPublicIds();
    await CorrectInstrumentTagPublicIds();
    await CorrectInstrumentTagAssociationPublicIds();
    await CorrectSongTagPublicIds();
    await CorrectSongTagAssociationPublicIds();
    await CorrectSongCreditTypePublicIds();
    await CorrectSongCreditPublicIds();
    await CorrectFileTagPublicIds();
    await CorrectFileTagAssignmentPublicIds();
    await CorrectWikiPageTagPublicIds();
    await CorrectWikiPageTagAssignmentPublicIds();
    await CorrectEventTypePublicIds();
    await CorrectEventStatusPublicIds();
    await CorrectEventTagPublicIds();
    await CorrectEventTagAssignmentPublicIds();
    await CorrectUserTagPublicIds();
    await CorrectUserTagAssignmentPublicIds();
    await CorrectUserInstrumentPublicIds();
    await CorrectFileUserTagPublicIds();
    await CorrectFileSongTagPublicIds();
    await CorrectFileEventTagPublicIds();
    await CorrectFileInstrumentTagPublicIds();
    await CorrectFileWikiPageTagPublicIds();
    await CorrectPermissionPublicIds();
    await CorrectRolePublicIds();
    await CorrectRolePermissionPublicIds();
    await CorrectUserSignInMethodPublicIds();
    await CorrectEventPublicIds();
    await MigrateEventPublicIdReferences();
    await CorrectEventSegmentPublicIds();
    await CorrectEventUserResponsePublicIds();
    await CorrectEventSegmentUserResponsePublicIds();
    await CorrectEventAttendancePublicIds();
    await CorrectEventSongListPublicIds();
    await CorrectEventSongListSongPublicIds();
    await CorrectEventSongListDividerPublicIds();

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
