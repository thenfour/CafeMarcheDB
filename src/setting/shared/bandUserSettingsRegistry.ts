import { freezeRegistry } from "./registryHelpers";
import { stringSetting } from "./settingsHelpers";
import { normalizeLocaleTag } from "src/locale/shared/localePreferences";
import { z } from "zod";

// settings which are per band-user membership

export const kBandUserSettingsRegistry = freezeRegistry({
    "calendar.locale": stringSetting({
        defaultValue: "en-US",
        schema: z.string().transform(normalizeLocaleTag),
        stringFormat: "plain",
    }),
});

