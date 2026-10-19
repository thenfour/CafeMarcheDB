import { z } from "zod";
import { Permission } from "shared/permissions";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import type { PermissionRequirement } from "src/auth/shared/permissionRequirement";
import { BandPublicIdSchema } from "./presentationInput";
import { normalizeLocaleTag, type LocalePreferences } from "./localePreferences";
import { kStaticLocalizedStringRegistry, type StaticLocalizedStringKey } from "./staticLocalizedStringRegistry";

function isRegisteredStringKey(key: string): key is StaticLocalizedStringKey {
    return Object.prototype.hasOwnProperty.call(kStaticLocalizedStringRegistry, key);
}

export const StaticStringKeySchema = z.string().refine(isRegisteredStringKey, "Choose a registered string key")
    .transform(key => {
        if (!isRegisteredStringKey(key)) {
            throw new Error("Unknown localized string key.");
        }
        return key;
    });

export const StaticStringTargetSchema = z.object({
    key: StaticStringKeySchema,
    scope: z.enum(["global", "band"]),
    localeTag: z.string().min(1).max(128).transform(normalizeLocaleTag),
    bandPublicId: BandPublicIdSchema.nullable(),
})
    .strict()
    .refine(target => target.scope !== "band" || target.bandPublicId !== null,
        "Band translations require an explicit band");

export const StaticStringWriteSchema = z.object({
    target: StaticStringTargetSchema,
    operation: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("set"), value: z.string().max(1_000_000) }).strict(),
        z.object({ kind: z.literal("reset") }).strict(),
    ]),
}).strict();

export type StaticStringTarget = z.infer<typeof StaticStringTargetSchema>;
export type StaticStringWrite = z.infer<typeof StaticStringWriteSchema>;
export interface StaticStringEditorData {
    readonly value: string | null;
    readonly canSet: boolean;
}

export function staticStringWritePermission(scope: StaticStringTarget["scope"]): PermissionRequirement {
    return scope === "global" ? Permission.manage_global_localization : BandPermission.manage_band_localization;
}

// used by the editing components to target specific entry / locale combos
// it's slightly more than just "tell me which locale you want to edit" --
// it's a small negotiation between
// your display prefs, and the available locale tags in the current scope/context.
// it allows editing in your current preferred locale, despite the string resolution
// rules that would give fallbacks.
// IOW,
// you can be seeing a string in a fallback locale. when you edit it, you should be editing
// in a locale that's not the result of transparent fallback logic.
// it allows intuitive inline editing.
export function selectStaticStringEditLocale(preferences: LocalePreferences, enabledLocaleTags: readonly string[]): string {
    for (const preferred of preferences.orderedTags) {
        if (enabledLocaleTags.includes(preferred)) {
            return preferred;
        }
        const language = new Intl.Locale(preferred).language;
        const matching = enabledLocaleTags.find(tag => new Intl.Locale(tag).language === language);
        if (matching) {
            return matching;
        }
    }
    return enabledLocaleTags[0] ?? "";
}
