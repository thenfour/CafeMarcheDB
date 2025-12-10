
export interface ServerStartInfo {
    startedAt: Date,
    uptimeMS: number,
    gitRevision: string,
    gitCommitDate: string,
    baseUri: string,
};

export const getServerStartState = (): ServerStartInfo => {
    const startedAt = new Date(Number.parseInt(process.env.CMDB_START_TIME || ""));
    return {
        startedAt,
        uptimeMS: (new Date().valueOf()) - startedAt.valueOf(),
        gitRevision: process.env.CMDB_GIT_REVISION || "-",
        gitCommitDate: process.env.CMDB_GIT_COMMIT_DATE || "-",
        baseUri: process.env.CMDB_BASE_URL!,
    };
};
