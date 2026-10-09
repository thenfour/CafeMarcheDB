export interface SeedingConfig {
    bands: number;
    userCount: number;
    songCount: number;
    wikiPageCount: number;
    monthsBeforeNow: number;
    monthsAfterNow: number;
}

// Counts are totals across bands; the calendar density is per band, as in real usage.
export const defaultSeedingConfig: Readonly<SeedingConfig> = {
    bands: 2, userCount: 80, songCount: 100, wikiPageCount: 30,
    monthsBeforeNow: 40, monthsAfterNow: 6,
};

export function validateSeedingConfig(config: SeedingConfig): void {
    for (const value of Object.values(config)) {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new Error("Seed sizes must be nonnegative integers.");
        }
    }
    // Five shared/platform people, plus a manager and an ordinary demo member per band.
    if (config.bands < 1 || config.bands > 10 || config.userCount < config.bands * 2 + 5) {
        throw new Error("Seeding requires 1–10 bands and room for the shared, special, manager and ordinary demo accounts.");
    }
}

export function distributeSeedCount(total: number, bands: number, index: number): number {
    return Math.floor(total / bands) + (index < total % bands ? 1 : 0);
}
