import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Shared band catalog label", schema: z.string() });
export const catalogStrings = {
    "catalog.platformMode": label("Select Platform / account in the band selector to edit shared catalog defaults."),
    "catalog.songCreditTypes": label("Song Credit Types"),
    "catalog.name": label("Name"),
    "catalog.description": label("Description"),
    "catalog.locale": label("Translation language"),
    "catalog.inherit": label("Use inherited value"),
    "catalog.color": label("Color"),
    "catalog.sortOrder": label("Sort order"),
    "catalog.hidden": label("Hidden"),
    "catalog.group": label("Group"),
    "catalog.indicator": label("Indicator"),
    "catalog.indicatorCssClass": label("Indicator style"),
    "catalog.select": label("Option"),
    "catalog.selectBand": label("Select a band to view its catalog."),
    "catalog.songTags": label("Song tags"),
    "catalog.missing": label("Translation unavailable"),
    "catalog.userTags": label("Member tags"),
    "catalog.cssClass": label("Style class"),
    "catalog.fileTags": label("File tags"),
    "catalog.globalFileTags": label("Shared file tags"),
    "catalog.fileTagsSharedDefaults": label("Partition and recording behavior comes from shared tag defaults, edited in Platform / account mode."),
    "catalog.eventTags": label("Event tags"),
    "catalog.globalEventTags": label("Shared event tags"),
    "catalog.eventTagsSharedDefaults": label("Public-site visibility comes from shared tag defaults, edited in Platform / account mode."),
};
