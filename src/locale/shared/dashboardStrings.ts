import { z } from "zod";
import { plainStaticString } from "./staticLocalizedStringRegistryHelpers";

const label = (defaultValue: string) => plainStaticString({ defaultValue, description: "Dashboard recovery interface", schema: z.string() });
export const dashboardStrings = {
    "dashboard.title": label("Home"),
    "dashboard.band.select": label("Select a band"),
    "dashboard.band.platform": label("Account and platform"),
    "dashboard.band.unnamed": label("Unnamed band"),
    "dashboard.band.unavailable": label("Selected band is unavailable to this account"),
    "dashboard.band.empty": label("This account has no active band memberships."),
    "dashboard.band.required": label("Select a band to view its members and catalogs."),
    "dashboard.band.switchFailed": label("Could not change bands. Try again."),
    "dashboard.instruments.missing": label("You have no instruments assigned in this band. Open your profile to choose them."),
    "dashboard.profile": label("Your profile"),
    "dashboard.deferred": label("Events, songs, files, announcements and custom navigation are temporarily unavailable while their band support is restored."),
};
