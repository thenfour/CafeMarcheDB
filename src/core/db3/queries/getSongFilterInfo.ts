// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace, SplitQuickFilter, assertIsNumberArray, mysql_real_escape_string } from "shared/utils";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetEventFilterInfoChipInfo, GetSongFilterInfoRet, MakeGetSongFilterInfoRet } from "../shared/apiTypes";

interface TArgs {
    filterSpec: {
        pageSize: number;
        page: number;

        quickFilter: string,
        tagIds: number[];
    }
};

export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    async (args: TArgs, ctx: AuthenticatedCtx): Promise<GetSongFilterInfoRet> => {
        try {
            const u = (await getCurrentUserCore(ctx))!;
            if (!u.role || u.role.permissions.length < 1) {
                return MakeGetSongFilterInfoRet();
            }

            assertIsNumberArray(args.filterSpec.tagIds);

            const songFilterExpressions: string[] = [];
            if (!IsNullOrWhitespace(args.filterSpec.quickFilter)) {

                // tokens are AND'd together.
                const tokens = SplitQuickFilter(args.filterSpec.quickFilter);
                const tokensExpr = tokens.map(t => {
                    const qf = mysql_real_escape_string(t);
                    const or = [
                        `(Song.name LIKE '%${qf}%')`,
                        `(Song.aliases LIKE '%${qf}%')`,
                    ];
                    return `(${or.join(" OR ")})`;
                });

                songFilterExpressions.push(`(${tokensExpr.join(" AND ")})`);
            }

            let havingClause = "";

            if (args.filterSpec.tagIds.length > 0) {
                songFilterExpressions.push(`(SongTagAssociation.tagId IN (${args.filterSpec.tagIds}))`);
                // make sure songs have matched ALL tags, not just any.
                havingClause = `
                HAVING
    				COUNT(DISTINCT SongTagAssociation.tagId) = ${args.filterSpec.tagIds.length}
                `;
            }

            const songFilterExpression = songFilterExpressions.length > 0 ? `(${songFilterExpressions.join(" and ")})` : "";

            const AND: string[] = [
                `Song.isDeleted = FALSE`,
            ];
            if (!u.isSysAdmin) {
                AND.push(`Song.visiblePermissionId IN (${u.role?.permissions.map(p => p.permissionId)})`);
                // TODO: handle private visibility (visiblePermissionId is null && creator = self)
            }
            if (!IsNullOrWhitespace(songFilterExpression)) {
                AND.push(songFilterExpression);
            }

            // this CTE should return a list of songs which match the filter.
            const filteredSongsCTE = `
        WITH FilteredSongs AS (
            SELECT 
                Song.id AS SongId,
                Song.name
            FROM 
                Song
            left JOIN 
                SongTagAssociation ON Song.id = SongTagAssociation.songId
            WHERE
                ${AND.join("\n AND ")}
            group by
                Song.id
            ${havingClause}
            )
        `;

            // TAGS
            const tagsQuery = `
        ${filteredSongsCTE}
    select
        ST.*,
        count(distinct(FS.SongId)) as song_count
    from
        FilteredSongs as FS
    join 
        SongTagAssociation as STA on FS.SongId = STA.songId
    join 
        SongTag as ST on ST.id = STA.tagId
    group by
        ST.id
    order by
        -- count(distinct(FS.SongId)) desc, -- seems natural to do this but it causes things to constantly reorder
        ST.sortOrder asc
        `;

            const tagsResult: ({ song_count: bigint } & Prisma.SongTagGetPayload<{}>)[] = await db.$queryRaw(Prisma.raw(tagsQuery));

            const tags: GetEventFilterInfoChipInfo[] = tagsResult.map(r => ({
                color: r.color,
                iconName: null,
                id: r.id,
                label: r.text,
                tooltip: r.description,
                rowCount: new Number(r.song_count).valueOf(),
            }));



            // PAGINATED RESULTS LIST
            const paginatedResultQuery = `
        ${filteredSongsCTE}
    select
        FS.SongId
    from
        FilteredSongs as FS
    order by
        FS.name ASC
    limit
        ${args.filterSpec.pageSize * args.filterSpec.page},${args.filterSpec.pageSize}

        `;

            const eventIds: { SongId: number }[] = await db.$queryRaw(Prisma.raw(paginatedResultQuery));



            // TOTAL filtered row count
            const totalRowCountQuery = `
        ${filteredSongsCTE}
    select
		count(*) as rowCount
    from
        FilteredSongs
        `;

            const rowCountResult: { rowCount: bigint, futureCount: bigint, pastCount: bigint }[] = await db.$queryRaw(Prisma.raw(totalRowCountQuery));


            return {
                rowCount: new Number(rowCountResult[0]!.rowCount).valueOf(),
                songIds: eventIds.map(e => e.SongId),

                tags,
                tagsQuery,
                paginatedResultQuery,
                totalRowCountQuery,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



