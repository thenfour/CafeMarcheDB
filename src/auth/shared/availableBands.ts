import type { BandIdentity } from "src/core/shared/bandIdentity";

export interface AvailableBand extends BandIdentity {
    readonly supportedLocales: readonly string[];
}
