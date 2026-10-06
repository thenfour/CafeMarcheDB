import { useMutation } from "@blitzjs/rpc";
import React from "react";
import { usePresentation } from "src/locale/components/PresentationProvider";
import updateSetting from "../server/mutations/updateSetting";
import { readSettingSnapshot, type SettingsHive, type SettingsKey, type SettingsValue } from "../shared/settingsContract";

function useSettingsHive<H extends SettingsHive>(hive: H) {
    const presentation = usePresentation();
    const [mutate] = useMutation(updateSetting);
    return React.useMemo(() => ({
        getValue<K extends SettingsKey<H>>(key: K): SettingsValue<H, K> {
            if (!presentation.data) throw new Error("Settings are not loaded.");
            return readSettingSnapshot(presentation.data.settings, hive, key);
        },
        getCapabilities<K extends SettingsKey<H>>(key: K) {
            return presentation.data?.settings[hive][key]?.capabilities ?? { canView: false, canEdit: false };
        },
        async setValue<K extends SettingsKey<H>>(key: K, value: SettingsValue<H, K>) {
            await mutate({ hive, key, operation: { kind: "set", value }, bandPublicId: presentation.bandPublicId });
            await presentation.invalidate();
        },
        async reset<K extends SettingsKey<H>>(key: K) {
            await mutate({ hive, key, operation: { kind: "reset" }, bandPublicId: presentation.bandPublicId });
            await presentation.invalidate();
        },
        refetch: presentation.invalidate,
    }), [hive, presentation, mutate]);
}

export const useGlobalSettings = () => useSettingsHive("global");
export const useBandSettings = () => useSettingsHive("band");
export const useUserSettings = () => useSettingsHive("user");
export const useBandUserSettings = () => useSettingsHive("bandUser");
