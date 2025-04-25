import { Stopwatch } from "@/shared/rootroot";
import { TAnyModel } from "@/src/core/db3/shared/apiTypes";
import { hash256 } from "@blitzjs/auth";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { MySqlDateTimeLiteral, MySqlStringLiteral, MySqlStringLiteralAllowingPercent, MySqlSymbol, parseBucketToDateRange } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { ActivityReportTimeBucketSize, FacetedBreakdownResult } from "../activityReportTypes";
import { ActivityFeature, Browsers, DeviceClasses, OperatingSystem, PointerTypes } from "../activityTracking";
import { GetSoftDeleteWhereExpression } from "@/src/core/db3/shared/db3Helpers";
import { xCustomLink, xEvent, xMenuLink, xSong, xWikiPage } from "@/src/core/db3/db3";
import { getCurrentUserCore } from "@/src/core/db3/server/db3mutationCore";

const ZTArgs = z.object({
  features: z.nativeEnum(ActivityFeature).array(),
  bucket: z.string().nullable(),
  aggregateBy: z.nativeEnum(ActivityReportTimeBucketSize),
  excludeYourself: z.boolean(),
  excludeSysadmins: z.boolean(),

  contextBeginsWith: z.string().optional(),
  refreshTrigger: z.number(),
});

type TArgs = z.infer<typeof ZTArgs>;

async function getFeatureReportFacetsAndCountsForSet(args: TArgs, ctx: AuthenticatedCtx): Promise<FacetedBreakdownResult | null> {
  if (!args.bucket) {
    return null;
  }
  const currentUser = await getCurrentUserCore(ctx);
  if (!currentUser) {
    return null;
  }

  // each query is in the form of:
  /*
  
with FilteredSet as (
  select
      songId,             <---- facets grouping expr here.
      count(*) as count
  from
      Action
  where
      createdAt > '20250410'
      -- additional filtering....
  group by
      songId             <---- facets grouping expr here.
)
select                   <-- facets can return their own data set.
  x.id,  
  x.name
from
  FilteredSet
  join Song x on FilteredSet.songId = x.id

  */

  const dateRange = parseBucketToDateRange(args.bucket, args.aggregateBy);
  //debugger;

  function buildFiltersSQL(): string {
    const conditions: string[] = [];

    conditions.push(`${MySqlSymbol("createdAt")} >= ${MySqlDateTimeLiteral(dateRange.start)}`);
    conditions.push(`${MySqlSymbol("createdAt")} <= ${MySqlDateTimeLiteral(dateRange.end)}`);

    // TODO: add other filters here
    if (args.features.length > 0) {
      conditions.push(`${MySqlSymbol("feature")} IN (${args.features.map((f) => MySqlStringLiteral(f)).join(",")})`);
    }
    if (args.contextBeginsWith) {
      conditions.push(`${MySqlSymbol("context")} LIKE ${MySqlStringLiteralAllowingPercent(args.contextBeginsWith + "%")}`);
    }
    if (args.excludeYourself) {
      conditions.push(`${MySqlSymbol("userId")} != ${ctx.session.userId}`);
    }
    if (args.excludeSysadmins) {
      // conditions.push(`(userId NOT IN (SELECT id FROM User WHERE isSysAdmin = 1))`);
      conditions.push(`${MySqlSymbol("userId")} NOT IN (SELECT ${MySqlSymbol("id")} FROM \`User\` WHERE ${MySqlSymbol("isSysAdmin")} = 1)`);
    }

    // excludeYourself: z.boolean(),
    // excludeSysadmins: z.boolean(),

    // contextBeginsWith: z.string().optional(),


    return conditions.join(" AND ");
  }

  const filterSql = buildFiltersSQL();

  interface FacetProcessor<T> {
    getGroupedQuery: () => string;
    postProcessRow: (row: unknown) => T | null; // if null, excluded.
  }

  const nullFacetProcessor: FacetProcessor<null> = {
    getGroupedQuery: () => {
      return `select 1`;
    },
    postProcessRow: (row: any) => null,
  };

  const totalFacetProcessor: FacetProcessor<FacetedBreakdownResult['total']> = {
    getGroupedQuery: () => {
      return `
            SELECT
              COUNT(*) AS count
            FROM Action
            WHERE ${filterSql}
          `;
    },
    postProcessRow: (row: { count: bigint }) => ({
      count: Number(row.count),
    }),
  };

  const featuresFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['features'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              feature,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and feature IS NOT NULL
            GROUP BY feature
          `;
    },
    postProcessRow: (row: { feature: string, count: bigint }) => ({
      feature: row.feature as ActivityFeature,
      count: Number(row.count),
    }),
  };

  const contextsFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['contexts'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              context,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and context IS NOT NULL
            GROUP BY context
          `;
    },
    postProcessRow: (row: { context: string, count: bigint }) => ({
      context: row.context,
      count: Number(row.count),
    }),
  };

  const browsersFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['browsers'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              browserName,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and browserName IS NOT NULL
            GROUP BY browserName
          `;
    },
    postProcessRow: (row: { browserName: string, count: bigint }) => {
      return ({
        browserName: row.browserName as Browsers,
        count: Number(row.count),
      });
    }
    ,
  };

  const operatingSystemsFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['operatingSystems'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              operatingSystem,
              COUNT(*) AS count
            FROM Action
            WHERE 
                ${filterSql}
                and operatingSystem IS NOT NULL
            GROUP BY operatingSystem
          `;
    },
    postProcessRow: (row: { operatingSystem: string, count: bigint }) => {
      return ({
        operatingSystem: row.operatingSystem as OperatingSystem,
        count: Number(row.count),
      });
    },
  };

  const pointerTypesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['pointerTypes'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              pointerType,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and pointerType IS NOT NULL
            GROUP BY pointerType
          `;
    },
    postProcessRow: (row: { pointerType: string, count: bigint }) => {
      return ({
        pointerType: row.pointerType as PointerTypes,
        count: Number(row.count),
      });
    },
  };

  const deviceClassesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['deviceClasses'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              deviceClass,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and deviceClass IS NOT NULL
            GROUP BY deviceClass
          `;
    },
    postProcessRow: (row: { deviceClass: string, count: bigint }) => {
      return ({
        deviceClass: row.deviceClass as DeviceClasses,
        count: Number(row.count),
      });
    },
  };

  const languagesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['languages'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              language,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and language IS NOT NULL
            GROUP BY language
          `;
    },
    postProcessRow: (row: { language: string, count: bigint }) => {
      return ({
        language: row.language,
        count: Number(row.count),
      });
    },
  };

  const localesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['locales'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              locale,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and locale IS NOT NULL
            GROUP BY locale
          `;
    },
    postProcessRow: (row: { locale: string, count: bigint }) => {
      return ({
        locale: row.locale,
        count: Number(row.count),
      });
    },
  };

  const timezonesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['timezones'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              timezone,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and timezone IS NOT NULL
            GROUP BY timezone
          `;
    },
    postProcessRow: (row: { timezone: string, count: bigint }) => {
      return ({
        timezone: row.timezone,
        count: Number(row.count),
      });
    },
  };

  const screenSizesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['screenSizes'][0]> = {
    getGroupedQuery: () => {
      return `
            SELECT
              screenHeight, screenWidth,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and screenHeight IS NOT NULL
                and screenWidth IS NOT NULL
            GROUP BY screenHeight, screenWidth
          `;
    },
    postProcessRow: (row: { screenHeight: number, screenWidth: number, count: bigint }) => {
      return ({
        height: row.screenHeight,
        width: row.screenWidth,
        count: Number(row.count),
      });
    },
  };

  const anonymizedUsersFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['users'][0]> = {
    getGroupedQuery: () => {
      return `
              SELECT
                userId,
                COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and userId IS NOT NULL
              GROUP BY userId
          `;
    },
    postProcessRow: (row: { userId: number, count: bigint }) => {
      // to anonymize users as much as possible, hash their userID with a deterministic salt
      // which is a hash of query params.
      const anonymizedUserId = `${filterSql}_5e0a4383307e4eb8322397d4bce4de0375e37c1a6c76bdb39abf5143e538b01b_${row.userId}`;
      return ({
        userHash: hash256(anonymizedUserId),
        count: Number(row.count),
      });
    },
  };

  const songsFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['songs'][0]> = {
    getGroupedQuery: () => {
      return `
            WITH FilteredSet AS (
              SELECT songId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and songId IS NOT NULL
              GROUP BY songId
            )
            SELECT
              s.id AS songId,
              s.name,
              fs.count
            FROM FilteredSet fs
            JOIN Song s ON fs.songId = s.id
            WHERE ${xSong.SqlGetVisFilterExpression(currentUser, "s")}
          `;
    },
    postProcessRow: (row: { songId: number, name: string, count: bigint }) => ({
      songId: row.songId,
      name: row.name,
      count: Number(row.count),
    }),
  };

  const eventsFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['events'][0]> = {
    getGroupedQuery: () => {
      return `
            WITH FilteredSet AS (
              SELECT eventId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and eventId IS NOT NULL
              GROUP BY eventId
            )
            SELECT
              e.id AS eventId,
              e.name,
              fs.count
            FROM FilteredSet fs
            JOIN Event e ON fs.eventId = e.id
            WHERE ${xEvent.SqlGetVisFilterExpression(currentUser, "e")}
          `;
    },
    postProcessRow: (row: { eventId: number, name: string, statusId: number | null, typeId: number | null, startsAt: Date | null, count: bigint }) => ({
      eventId: row.eventId,
      count: Number(row.count),
      name: row.name,
      startsAt: row.startsAt,
      statusId: row.statusId,
      typeId: row.typeId,


    }),
  };

  const wikiPagesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['wikiPages'][0]> = {
    getGroupedQuery: () => {
      return `
            WITH FilteredSet AS (
              SELECT wikiPageId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and wikiPageId IS NOT NULL
              GROUP BY wikiPageId
            )
            SELECT
              e.id AS wikiPageId,
              e.slug,
              fs.count
            FROM FilteredSet fs
            JOIN WikiPage e ON fs.wikiPageId = e.id
            WHERE ${xWikiPage.SqlGetVisFilterExpression(currentUser, "e")}
          `;
    },
    postProcessRow: (row: { wikiPageId: number, slug: string, count: bigint }) => ({
      wikiPageId: row.wikiPageId,
      slug: row.slug,
      count: Number(row.count),
    }),
  };

  const menuLinksFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['menuLinks'][0]> = {
    getGroupedQuery: () => {
      return `
            WITH FilteredSet AS (
              SELECT menuLinkId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and menuLinkId IS NOT NULL
              GROUP BY menuLinkId
            )
            SELECT
              e.id AS menuLinkId,
              e.caption,
              fs.count
            FROM FilteredSet fs
            JOIN MenuLink e ON fs.menuLinkId = e.id
            WHERE ${xMenuLink.SqlGetVisFilterExpression(currentUser, "e")}
          `;
    },
    postProcessRow: (row: { menuLinkId: number, caption: string, count: bigint }) => ({
      menuLinkId: row.menuLinkId,
      name: row.caption,
      count: Number(row.count),
    }),
  };

  const customLinksFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['customLinks'][0]> = {
    getGroupedQuery: () => {
      return `
            WITH FilteredSet AS (
              SELECT customLinkId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and customLinkId IS NOT NULL
              GROUP BY customLinkId
            )
            SELECT
              e.id AS customLinkId,
              e.name,
              fs.count
            FROM FilteredSet fs
            JOIN CustomLink e ON fs.customLinkId = e.id
            WHERE ${xCustomLink.SqlGetVisFilterExpression(currentUser, "e")}
          `;
    },
    postProcessRow: (row: { customLinkId: number, name: string, count: bigint }) => ({
      customLinkId: row.customLinkId,
      name: row.name,
      count: Number(row.count),
    }),
  };

  const facetProcessors: Record<keyof FacetedBreakdownResult['facets'], FacetProcessor<unknown>> = {
    features: featuresFacetProcessor,
    contexts: contextsFacetProcessor,
    operatingSystems: operatingSystemsFacetProcessor,
    pointerTypes: pointerTypesFacetProcessor,
    browsers: browsersFacetProcessor,
    deviceClasses: deviceClassesFacetProcessor,
    languages: languagesFacetProcessor,
    locales: localesFacetProcessor,
    timezones: timezonesFacetProcessor,
    screenSizes: screenSizesFacetProcessor,
    users: anonymizedUsersFacetProcessor,
    songs: songsFacetProcessor,

    events: eventsFacetProcessor,
    wikiPages: wikiPagesFacetProcessor,
    menuLinks: menuLinksFacetProcessor,
    customLinks: customLinksFacetProcessor,
  } as const;

  const sw = new Stopwatch();

  const doProcessor = async <T,>(facetKey: string, processor: FacetProcessor<T>) => {
    const query = processor.getGroupedQuery();
    const rawRows = await db.$queryRaw(Prisma.raw(query)) as TAnyModel[];
    const processedRows = rawRows.map((row) => processor.postProcessRow(row)).filter((row) => row !== null);

    //console.log(query);
    //console.log(`-> ${facetKey}: ${rawRows.length} -> ${processedRows.length}`);
    //console.log(`${facetKey}`, rawRows, processedRows);
    // console.log({
    //     facetKey,
    //     query: query.text,
    //     rawRows: rawRows.length,
    //     processedRows: processedRows.length,
    //     elapsedMs: sw.ElapsedMillis,
    // });
    return processedRows;
  };

  const facetResults = await Promise.all(
    Object.entries(facetProcessors).map(async ([facetKey, processor]) => {
      return [facetKey, await doProcessor(facetKey, processor)];
    })
  );

  const totals = await doProcessor("total", totalFacetProcessor);

  const ret: FacetedBreakdownResult = {
    metrics: {
      queryTimeMs: sw.ElapsedMillis,
    },
    total: totals[0]!,
    facets: Object.fromEntries(facetResults) as FacetedBreakdownResult['facets'],
  };

  console.log(ret);

  return ret;
}

export default resolver.pipe(
  resolver.zod(ZTArgs),
  resolver.authorize(Permission.sysadmin),
  async (args, ctx: AuthenticatedCtx): Promise<FacetedBreakdownResult | null> => {
    return await getFeatureReportFacetsAndCountsForSet(args, ctx);
  }
);
