// https://github.com/vercel/next.js/discussions/15341
// Run code once per node server startup
export const runtime = 'nodejs';

import db from "db"
import { execSync } from "child_process";
import { nanoid } from "nanoid";
import { instrumentationSetup } from "./setup/instrumentation-setup";

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
    // Fetch users with null uids
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

export async function register() {
    console.log(`INSTRUMENTATION RUNNING`);
    await instrumentationSetup();

    await CorrectUserUids();
    await CorrectEventSegmentUids();

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
