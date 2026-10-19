import type { BandPublicId } from "shared/publicId";
import type { ScopedAuthorizationData } from "src/auth/shared/cmAuthorization";
import type { SettingsSnapshot } from "src/setting/shared/settingsContract";
import type { LocalizationCatalog } from "./localizationCatalog";
import type { PresentationInput } from "./presentationInput";

export interface BandPresentation {
    readonly publicId: BandPublicId;
    readonly name: string | null;
}

export interface PresentationData {
    readonly input: PresentationInput;
    readonly authorization: ScopedAuthorizationData;
    readonly band: BandPresentation | null;
    readonly localization: LocalizationCatalog;
    readonly settings: SettingsSnapshot;
    readonly queryExecutionTimeMs: number;
}

/** Entire preference lists partition caches, even when formatting resolves to the same locale. */
export function presentationContextKey(input: PresentationInput): string {
    return JSON.stringify({
        bandPublicId: input.bandPublicId ?? null,
        routeLocale: input.routeLocale ?? null,
        browserLanguages: input.browserLanguages ?? [],
    });
}
