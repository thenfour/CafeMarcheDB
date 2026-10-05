import { z } from "zod";
import { booleanSetting } from "./settingsHelpers";
import { freezeRegistry } from "./registryHelpers";

export const kUserSettingsRegistry = freezeRegistry({
    "calendar.showDeclinedEvents": booleanSetting({
        defaultValue: true,
        schema: z.boolean(),
    }),
    "calendar.showUninvitedEvents": booleanSetting({
        defaultValue: true,
        schema: z.boolean(),
    }),
}); 
