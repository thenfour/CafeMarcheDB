import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Event statistics text", schema: z.string() });
export const eventStatisticsStrings = {
    "eventStatistics.title": label("Global Stats"),
    "eventStatistics.graphs": label("Show graphs"),
    "eventStatistics.popular": label("Most popular songs (top 10)"),
    "eventStatistics.loading": label("Loading event statistics…"),
    "eventStatistics.failed": label("Event statistics could not be loaded."),
    "eventStatistics.unavailable": label("Event statistics require a selected band and permission to view reports."),
    "eventStatistics.events": plainStaticString({
        defaultValue: "Event activity ({count})", description: "Number of matching Events", schema: z.string(),
        parameters: [{ key: "count", description: "Matching Events", type: "number" }],
    }),
};
