import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import React from "react";
import { kBandSettingsRegistry } from "../shared/bandSettingsRegistry";
import { kBandUserSettingsRegistry } from "../shared/bandUserSettingsRegistry";
import { kGlobalSettingsRegistry } from "../shared/globalSettingsRegistry";
import { IMutableRegistry, RegistryKey, RegistryValueOf } from "../shared/registryHelpers";
import { kUserSettingsRegistry } from "../shared/userSettingsRegistry";

//--------------------------------------------------------------------------------------------------------------------------------------------
type GlobalSettingsRegistryType = typeof kGlobalSettingsRegistry;
type GlobalSettingsApi = IMutableRegistry<GlobalSettingsRegistryType>;
type GlobalSettingsKey = RegistryKey<GlobalSettingsRegistryType>;
type GlobalSettingsValueOf<TKey extends GlobalSettingsKey> = RegistryValueOf<GlobalSettingsRegistryType, TKey>;

export const useGlobalSettings = (): GlobalSettingsApi => {
    const dashboardContext = useDashboardContext(); // the dashboard context contains the raw DTO payloads
    const ret = React.useMemo<GlobalSettingsApi>(() => ({
        getCapabilities: <TKey extends GlobalSettingsKey>(key: TKey, auth) => {
            //return { canEdit: true, canView: true };
        },
        getValue: <TKey extends GlobalSettingsKey>(key: TKey) => {
            // todo
            const entryDto = dashboardContext.settings.globalSettings.find(setting => setting.name === key);
            return JSON.parse(entryDto?.value ?? "null");
        },
        refetch: () => {
            // todo.
        },
        setValue: async <TKey extends GlobalSettingsKey>(key: TKey, value: GlobalSettingsValueOf<TKey>) => {
            // todo.
        },
    }), [dashboardContext]);
    return ret;
};

//--------------------------------------------------------------------------------------------------------------------------------------------
type BandSettingsRegistryType = typeof kBandSettingsRegistry;
type BandSettingsApi = IMutableRegistry<BandSettingsRegistryType>;
type BandSettingsKey = RegistryKey<BandSettingsRegistryType>;
type BandSettingsValueOf<TKey extends BandSettingsKey> = RegistryValueOf<BandSettingsRegistryType, TKey>;

export const useBandSettings = (): BandSettingsApi => {
    const dashboardContext = useDashboardContext();
    const ret = React.useMemo<BandSettingsApi>(() => ({
        getCapabilities: <TKey extends BandSettingsKey>(key: TKey, auth) => {
            //return { canEdit: true, canView: true };
        },
        getValue: <TKey extends BandSettingsKey>(key: TKey) => {
            const entryDto = dashboardContext.settings.bandSettings.find(setting => setting.name === key);
            return JSON.parse(entryDto?.value ?? "null");
        },
        refetch: () => {
            // todo.
        },
        setValue: async <TKey extends BandSettingsKey>(key: TKey, value: BandSettingsValueOf<TKey>) => {
            // todo.
        },
    }), [dashboardContext]);
    return ret;
};

//--------------------------------------------------------------------------------------------------------------------------------------------
// useBandUserSettings
type BandUserSettingsRegistryType = typeof kBandUserSettingsRegistry;
type BandUserSettingsApi = IMutableRegistry<BandUserSettingsRegistryType>;
type BandUserSettingsKey = RegistryKey<BandUserSettingsRegistryType>;
type BandUserSettingsValueOf<TKey extends BandUserSettingsKey> = RegistryValueOf<BandUserSettingsRegistryType, TKey>;

export const useBandUserSettings = (): BandUserSettingsApi => {
    const dashboardContext = useDashboardContext();
    const ret = React.useMemo<BandUserSettingsApi>(() => ({
        getCapabilities: <TKey extends BandUserSettingsKey>(key: TKey, auth) => {
            //return { canEdit: true, canView: true };
        },
        getValue: <TKey extends BandUserSettingsKey>(key: TKey) => {
            const entryDto = dashboardContext.settings.bandUserSettings.find(setting => setting.name === key);
            return JSON.parse(entryDto?.value ?? "null");
        },
        refetch: () => {
            // todo.
        },
        setValue: async <TKey extends BandUserSettingsKey>(key: TKey, value: BandUserSettingsValueOf<TKey>) => {
            // todo.
        },
    }), [dashboardContext]);
    return ret;
};

//--------------------------------------------------------------------------------------------------------------------------------------------
// useUserSettings
type UserSettingsRegistryType = typeof kUserSettingsRegistry;
type UserSettingsApi = IMutableRegistry<UserSettingsRegistryType>;
type UserSettingsKey = RegistryKey<UserSettingsRegistryType>;
type UserSettingsValueOf<TKey extends UserSettingsKey> = RegistryValueOf<UserSettingsRegistryType, TKey>;

export const useUserSettings = (): UserSettingsApi => {
    const dashboardContext = useDashboardContext();
    const ret = React.useMemo<UserSettingsApi>(() => ({
        getCapabilities: <TKey extends UserSettingsKey>(key: TKey, auth) => {
            //return { canEdit: true, canView: true };
        },
        getValue: <TKey extends UserSettingsKey>(key: TKey) => {
            const entryDto = dashboardContext.settings.userSettings.find(setting => setting.name === key);
            return JSON.parse(entryDto?.value ?? "null");
        },
        refetch: () => {
            // todo.
        },
        setValue: async <TKey extends UserSettingsKey>(key: TKey, value: UserSettingsValueOf<TKey>) => {
            // todo.
        },
    }), [dashboardContext]);
    return ret;
};
