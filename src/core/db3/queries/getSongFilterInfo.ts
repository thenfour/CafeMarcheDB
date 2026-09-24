import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { MysqlEscape } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { SplitQuickFilter } from "shared/quickFilter";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "../db3";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { queryTable } from "../server/db3QueryCore";
import { EventRelevantFilterExpression, GetEventFilterInfoChipInfo, GetSongFilterInfoRet, MakeGetSongFilterInfoRet, SongSelectionFilter } from "../shared/apiTypes";
import { resolvePublicIds } from "../server/db3PublicIds";
import { parsePublicId, type SongTagPublicId } from "shared/publicId";

interface TArgs {
    filterSpec: {
        pageSize: number;
        page: number;
        selection: SongSelectionFilter;

        quickFilter: string,
        tagIds: SongTagPublicId[];
    }
};

export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    async (args: TArgs, ctx: AuthenticatedCtx): Promise<GetSongFilterInfoRet> => {
        try {
            const authorization = await getRequestAuthorization(ctx.session);
            const u = (await getCurrentUserCore(ctx))!;
            if (!u.role || u.role.permissions.length < 1) {
                return MakeGetSongFilterInfoRet();
            }

            const tagIds = await resolvePublicIds(
                db3.xSongTag,
                args.filterSpec.tagIds,
                db3.createDB3Authorization(authorization.user, authorization.effectivePermissions),
                db,
            );

            const songFilterExpressions: string[] = [];
            if (!IsNullOrWhitespace(args.filterSpec.quickFilter)) {

                // tokens are AND'd together.
                const tokens = SplitQuickFilter(args.filterSpec.quickFilter);
                const tokensExpr = tokens.map(t => {
                    const qf = MysqlEscape(t);
                    const or = [
                        `(Song.name LIKE '%${qf}%')`,
                        `(Song.aliases LIKE '%${qf}%')`,
                    ];
                    return `(${or.join(" OR ")})`;
                });

                songFilterExpressions.push(`(${tokensExpr.join(" AND ")})`);
            }

            let havingClause = "";

            if (tagIds.length > 0) {
                songFilterExpressions.push(`(SongTagAssociation.tagId IN (${tagIds}))`);
                // make sure songs have matched ALL tags, not just any.
                havingClause = `
                HAVING
					COUNT(DISTINCT SongTagAssociation.tagId) = ${tagIds.length}
                `;
            }

            const songFilterExpression = songFilterExpressions.length > 0 ? `(${songFilterExpressions.join(" and ")})` : "";

            const AND: string[] = [];
            AND.push(db3.xSong.SqlGetVisFilterExpression(u, "Song"));

            if (!IsNullOrWhitespace(songFilterExpression)) {
                AND.push(songFilterExpression);
            }

            // this CTE should return a list of songs which match the filter.
            const filteredSongsCTE = `
        WITH RelevantSongs as (
            select
                ESLS.songID
            from 
                Event E
            join
                EventSongList ESL on E.id = ESL.eventId
            join
                EventSongListSong ESLS on ESL.id = ESLS.eventSongListId
            where 
                ${EventRelevantFilterExpression({ startsAtExpr: `startsAt` })}
            group by
                ESLS.songID
            order by
                songID
            ),
        FilteredSongs AS (
            SELECT 
                Song.id AS SongId,
                Song.name
            FROM 
                Song
            ${args.filterSpec.selection === "relevant" ? "inner join RelevantSongs RS on RS.songId = Song.id" : ""}
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

            const tags: GetEventFilterInfoChipInfo<SongTagPublicId>[] = tagsResult.map(r => ({
                color: r.color,
                iconName: null,
                id: parsePublicId<"SongTag">(r.publicId),
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

            const songIds: { SongId: number }[] = await db.$queryRaw(Prisma.raw(paginatedResultQuery));

            // TOTAL filtered row count
            const totalRowCountQuery = `
        ${filteredSongsCTE}
    select
		count(*) as rowCount
    from
        FilteredSongs
        `;

            const rowCountResult: { rowCount: bigint, futureCount: bigint, pastCount: bigint }[] = await db.$queryRaw(Prisma.raw(totalRowCountQuery));





            // FULL EVENT DETAILS USING DB3.
            let fullSongs: db3.SongSearchDto[] = [];
            if (songIds.length) {
                const tableParams: db3.SongTableParams = {
                    songIds: songIds.map(e => e.SongId), // prevent fetching the entire table!
                };

                const queryResult = await queryTable({
                    cmdbQueryContext: "getSongFilterInfo",
                    table: {
                        tableID: db3.xSong.tableID,
                        tableName: db3.xSong.tableName,
                        viewID: db3.songSearchView.viewID,
                    },
                    filter: {
                        tableParams,
                    },
                    orderBy: undefined,
                }, authorization);

                // queryTable's legacy return type does not yet carry its view.
                fullSongs = queryResult.items as db3.SongSearchDto[];
            }


            const isUserSysadmin = authorization.effectivePermissions.includesName(Permission.sysadmin);

            return {
                rowCount: new Number(rowCountResult[0]!.rowCount).valueOf(),
                songIds: songIds.map(e => e.SongId),

                tags,
                // Raw SQL contains trusted natural IDs and remains server-only.
                tagsQuery: isUserSysadmin ? tagsQuery : "",
                paginatedResultQuery: isUserSysadmin ? paginatedResultQuery : "",
                totalRowCountQuery: isUserSysadmin ? totalRowCountQuery : "",

                fullSongs,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



