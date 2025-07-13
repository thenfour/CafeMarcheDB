import { Stopwatch } from "@/shared/rootroot";
import { getCurrentUserCore } from "@/src/core/db3/server/db3mutationCore";
import { TAnyModel } from "@/src/core/db3/shared/apiTypes";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { FacetedBreakdownResult, ZFeatureReportFilterSpec } from "../activityReportTypes";
import { buildFeatureReportFiltersSQL, FacetProcessor, gFeatureReportFacetProcessors, TotalFacetProcessor } from "../server/facetProcessor";

const ZTArgs = z.object({
  refreshTrigger: z.number(),
  filterSpec: ZFeatureReportFilterSpec,
});

type TArgs = z.infer<typeof ZTArgs>;

async function getFeatureReportFacetsAndCountsForSet(args: TArgs, ctx: AuthenticatedCtx): Promise<FacetedBreakdownResult | null> {
  if (!args.filterSpec.selectedBucket) {
    return null;
  }
  const currentUser = await getCurrentUserCore(ctx);
  if (!currentUser) {
    return null;
  }

  const filterSql = buildFeatureReportFiltersSQL(args.filterSpec, currentUser);

  const sw = new Stopwatch();

  const doProcessor = async <T,>(facetKey: string, processor: FacetProcessor<T>) => {
    const query = processor.getGroupedQuery(filterSql, currentUser);
    const rawRows = await db.$queryRaw(Prisma.raw(query)) as TAnyModel[];
    const processedRows = rawRows.map((row) => processor.postProcessRow(row, filterSql, currentUser)).filter((row) => row !== null);
    return processedRows;
  };

  const facetResults = await Promise.all(
    Object.entries(gFeatureReportFacetProcessors).map(async ([facetKey, processor]) => {
      return [facetKey, await doProcessor(facetKey, processor)];
    })
  );

  const totals = await doProcessor("total", TotalFacetProcessor);

  const ret: FacetedBreakdownResult = {
    metrics: {
      queryTimeMs: sw.ElapsedMillis,
    },
    total: totals[0]!,
    facets: Object.fromEntries(facetResults) as FacetedBreakdownResult['facets'],
  };

  return ret;
}

export default resolver.pipe(
  resolver.zod(ZTArgs),
  resolver.authorize(Permission.view_feature_reports),
  async (args, ctx: AuthenticatedCtx): Promise<FacetedBreakdownResult | null> => {
    return await getFeatureReportFacetsAndCountsForSet(args, ctx);
  }
);
