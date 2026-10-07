import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Shared event catalog editor text", schema: z.string() });
export const eventCatalogStrings = {
    "eventCatalog.types.title": label("Event Types"),
    "eventCatalog.statuses.title": label("Event Statuses"),
    "eventCatalog.attendance.title": label("Event Attendance Options"),
    "eventCatalog.platformMode": label("Select Platform / account in the band selector to edit shared event catalog defaults."),
};
