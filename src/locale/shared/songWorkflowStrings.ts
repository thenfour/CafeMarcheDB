import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Song credit and performance history text", schema: z.string() });
export const songWorkflowStrings = {
    "songCredits.title": label("Song credits"),
    "songCredits.invalidSong": label("Invalid song reference."),
    "songHistory.count": plainStaticString({
        defaultValue: "This song has appeared in {count} events that match your filter",
        description: "Number of matching song performances", schema: z.string(),
        parameters: [{ key: "count", description: "Matching events", type: "number" }],
    }),
    "songHistory.loading": label("Loading song history…"),
    "songHistory.unavailable": label("Song history requires permission to view events."),
    "songHistory.failed": label("Song history could not be loaded."),
    "songHistory.all": label("All"),
    "songHistory.past": label("All past"),
    "songHistory.future": label("Future"),
    "songHistory.fiveYears": label("Past 5 years"),
    "songHistory.year": label("Past year"),
};
