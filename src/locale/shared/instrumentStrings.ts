import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Instrument catalog label", schema: z.string() });
export const instrumentStrings = {
    "instrument.title": label("Instruments"), "instrument.groupsTitle": label("Functional groups"),
    "instrument.name": label("Name"), "instrument.description": label("Description"),
    "instrument.group": label("Functional group"), "instrument.locale": label("Translation language"),
    "instrument.color": label("Color"), "instrument.sortOrder": label("Sort order"),
    "instrument.matcher": label("File matcher"), "instrument.hidden": label("Hidden"),
    "instrument.add": label("Create custom entry"), "instrument.optIn": label("Add from global catalog"),
    "instrument.edit": label("Edit"), "instrument.save": label("Save"),
    "instrument.cancel": label("Cancel"), "instrument.search": label("Search names"),
    "instrument.inherit": label("Use inherited value"), "instrument.showHidden": label("Include hidden entries"),
    "instrument.noBand": label("Select a band to view its instruments."),
    "instrument.missing": label("Translation unavailable"), "instrument.notFound": label("Instrument not found"),
    "instrument.next": label("Next"), "instrument.previous": label("Previous"),
    "instrument.loading": label("Loading instruments…"),
};
