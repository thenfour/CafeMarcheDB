
// LSMB todo: use correct dto schema when xtable for settings is established.
export type GlobalSettingDto = {
    publicId: string; // todo: actual public id
    name: string;
    value: string | null;
    // updatedAt
    // updatedByUserId / updatedByUser
};

export type BandSettingDto = GlobalSettingDto & {
    bandId: string; // todo: actual public id
};

export type UserSettingDto = GlobalSettingDto & {
    userId: string; // todo: actual public id
};


export type BandUserSettingDto = GlobalSettingDto & {
    bandUserId: string; // todo: actual public id
    // bandUser
};

export type SettingsDto = {
    globalSettings: GlobalSettingDto[];
    bandSettings: BandSettingDto[];
    userSettings: UserSettingDto[];
    bandUserSettings: BandUserSettingDto[];
}

