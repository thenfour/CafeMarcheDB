import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Band member instrument label", schema: z.string() });
export const membershipStrings = {
    "membership.instruments.title": label("Member instruments"),
    "membership.instruments.edit": label("Edit instruments"),
    "membership.instruments.select": label("Select instruments"),
    "membership.instruments.default": label("Default"),
    "membership.instruments.changeDefault": label("Change default"),
    "membership.instruments.defaultTitle": label("Default instrument"),
    "membership.instruments.defaultDescription": label("When responding to events in this band, this instrument is selected by default."),
    "membership.instruments.unavailable": label("Unavailable instrument"),
    "membership.instruments.empty": label("No instruments selected."),
    "membership.instruments.saved": label("Instruments updated"),
    "membership.instruments.failed": label("Could not update instruments."),
    "membership.instruments.refreshFailed": label("Instruments saved. Reload this page to show the latest values."),
    "membership.instruments.saving": label("Saving instruments…"),
    "membership.instruments.noBand": label("Select a band to edit its member instruments."),
    "membership.instruments.noMembership": label("An active band membership is required to select your instruments."),
    "membership.instruments.notFound": label("This membership is no longer available."),
    "membership.instruments.hidden": label("Unavailable instruments remain assigned until you remove them."),
    "membership.instruments.member": label("Member"),
};
