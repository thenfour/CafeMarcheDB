import type { ScopedAuthorizationData } from "src/auth/shared/cmAuthorization";
import type { SettingsSnapshot } from "src/setting/shared/settingsContract";
import type { LocalizationCatalog } from "./localizationCatalog";
import type { PresentationInput } from "./presentationInput";

export interface PresentationData {
    readonly input: PresentationInput;
    readonly authorization: ScopedAuthorizationData;
    readonly localization: LocalizationCatalog;
    readonly settings: SettingsSnapshot;
}

/** Entire preference lists partition caches, even when formatting resolves to the same locale. */
export function presentationContextKey(input: PresentationInput): string {
    return JSON.stringify({
        selection: input.selection ?? { kind: "configured-band" },
        routeLocale: input.routeLocale ?? null,
        browserLanguages: input.browserLanguages ?? [],
    });
}
