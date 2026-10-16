import { execSync } from "node:child_process";
import { instrumentationSetup } from "./setup/instrumentation-setup";
import { getServerBandHostingConfig } from "./route/portalRouting";
import { requireValidBaseUrl } from "./route/server/portalConfig";

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

function validateEnv() {
    getServerBandHostingConfig(); // assumes throws if invalid
    requireValidBaseUrl();
}

export async function registerNodeInstrumentation() {
    console.log(`INSTRUMENTATION RUNNING`);
    await instrumentationSetup();

    // ensure config
    validateEnv();

    // Data backfills now run in SQL migrations, before application startup.
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
