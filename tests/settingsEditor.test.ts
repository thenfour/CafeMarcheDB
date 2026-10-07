import { describe, expect, it } from "vitest";
import { parseSettingsClipboard, serializeSettingsClipboard, getSettingsEditorLabelKey } from "src/setting/shared/settingsEditor";
import { settingsRegistries, type SettingsHive, type SettingsHiveSnapshot } from "src/setting/shared/settingsContract";

const bandSnapshot: SettingsHiveSnapshot = {
    "siteCustomization.title": { value: "Band A", source: "stored", capabilities: { canView: true, canEdit: true } },
    "dateTime.bandTimeZone": { value: "Europe/Brussels", source: "default", capabilities: { canView: true, canEdit: false } },
};

describe("registered settings editor clipboard", () => {
    it("preserves intentional blanks and false values in the selected scope", () => {
        expect(parseSettingsClipboard("band", bandSnapshot, '[{"key":"siteCustomization.title","value":""}]'))
            .toEqual([{ hive: "band", key: "siteCustomization.title", operation: { kind: "set", value: "" } }]);
        const snapshot: SettingsHiveSnapshot = { "calendar.showDeclinedEvents": {
            value: true, source: "default", capabilities: { canView: true, canEdit: true },
        } };
        expect(parseSettingsClipboard("user", snapshot, '[{"key":"calendar.showDeclinedEvents","value":false}]')[0]?.operation)
            .toEqual({ kind: "set", value: false });
    });

    it.each([
        '[]', '{}', '[{"key":"unknown","value":"x"}]',
        '[{"key":"siteCustomization.title"}]',
        '[{"key":"siteCustomization.title","value":false}]',
        '[{"key":"siteCustomization.title","value":"x","bandPublicId":"Band000000000002"}]',
        '[{"key":"siteCustomization.title","value":"x"},{"key":"siteCustomization.title","value":"y"}]',
        '[{"key":"siteCustomization.title","value":"x"},{"key":"dateTime.bandTimeZone","value":"UTC"}]',
    ])("rejects the entire malformed or unauthorized batch: %s", text => {
        expect(() => parseSettingsClipboard("band", bandSnapshot, text)).toThrow();
    });

    it("does not allow keys from another scope or a hidden value", () => {
        expect(() => parseSettingsClipboard("global", {}, '[{"key":"siteCustomization.title","value":"x"}]')).toThrow();
        expect(() => parseSettingsClipboard("band", {}, '[{"key":"siteCustomization.title","value":"x"}]')).toThrow();
    });

    it("normalizes membership locale values through the registered schema", () => {
        const snapshot: SettingsHiveSnapshot = { "calendar.locale": {
            value: "en-US", source: "default", capabilities: { canView: true, canEdit: true },
        } };
        expect(parseSettingsClipboard("bandUser", snapshot, '[{"key":"calendar.locale","value":"fr-be"}]')[0]?.operation)
            .toEqual({ kind: "set", value: "fr-BE" });
    });

    it("copies only visible values without transporting owner IDs or capabilities", () => {
        expect(JSON.parse(serializeSettingsClipboard({ ...bandSnapshot, hidden: {
            value: "secret", source: "stored", capabilities: { canView: false, canEdit: false },
        } }))).toEqual([
            { key: "siteCustomization.title", value: "Band A" },
            { key: "dateTime.bandTimeZone", value: "Europe/Brussels" },
        ]);
    });

    it("has registered labels for every settings entry", () => {
        const hives: readonly SettingsHive[] = ["global", "band", "user", "bandUser"];
        for (const hive of hives) {
            for (const key of Object.keys(settingsRegistries[hive])) {
                expect(getSettingsEditorLabelKey(hive, key)).toMatch(/^settings\.field\./);
            }
        }
    });
});
