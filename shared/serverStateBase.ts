
export interface ServerStartInfo {
    startedAt: Date,
    uptimeMS: number,
    gitRevision: string,
    gitCommitDate: Date,
    versionTag: string,
    versionCommitsSinceTag: number,
    versionIsDirty: boolean,
    baseUri: string,
};

export const getServerStartState = (): ServerStartInfo => {
    const startedAt = new Date(Number.parseInt(process.env.CMDB_START_TIME || ""));
    const commitsSinceTag = Number.parseInt(process.env.CMDB_VERSION_COMMITS_SINCE_TAG || "0", 10);
    return {
        startedAt,
        uptimeMS: (new Date().valueOf()) - startedAt.valueOf(),
        gitRevision: process.env.CMDB_GIT_REVISION || "-",
        gitCommitDate: new Date(process.env.CMDB_GIT_COMMIT_DATE || ""),
        versionTag: process.env.CMDB_VERSION_TAG || "-",
        versionCommitsSinceTag: Number.isFinite(commitsSinceTag) ? commitsSinceTag : 0,
        versionIsDirty: (process.env.CMDB_VERSION_IS_DIRTY || "false") === "true",
        baseUri: process.env.CMDB_BASE_URL!,
    };
};
