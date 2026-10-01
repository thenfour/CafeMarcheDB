import { isBandTimeZoneSetting, reanchorAllDayEvents } from "src/server/dateTime";
import type { CMServerAuthorization } from "../../auth/server/serverAuthorization";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import type { Prisma } from "db";
import { db3Server } from "src/core/db3/server/db3Server";
import { xSetting } from "src/core/db3/shared/db3schema";
import { resolveBandTimeZone } from "shared/dateTimePolicy";
import { Setting } from "shared/settingKeys";
import { loadBandTimeZone } from "@/src/server/bandTimeZone";

export type SettingValue = Prisma.SettingGetPayload<{}>;

// Generic setting editors must enforce the same scheduling contract as the
// branding form. Empty values retain their existing clear/default semantics.
export function validateSettingValue(name: string | undefined, value: string | null | undefined): void {
    if (name?.trim().toLowerCase() === Setting.BandTimeZone.toLowerCase()) {
        resolveBandTimeZone(value);
    }
}

// Delegated branding managers may change only declared branding keys. DB3's
// Setting mutation policy is Sysadmin-only, and its delete policy cannot model
// clearing an empty setting. Keep this narrow name-based writer behind the
// callers' fresh permission checks and shared serializable transactions.
export const writeSettingValue = async (args: {
    db: TransactionalPrismaClient;
    auth: CMServerAuthorization;
    //changeContext: ChangeContext;
    name: string;
    value: string | null | undefined;
}): Promise<SettingValue | null> => {
    validateSettingValue(args.name, args.value);
    const oldValue = await args.db.setting.findFirst({ where: { name: args.name } });
    if (oldValue && oldValue.name !== args.name) {
        validateSettingValue(oldValue.name, args.value);
    }
    const refreshBounds = async () => {
        if (isBandTimeZoneSetting(args.name) || isBandTimeZoneSetting(oldValue?.name)) {
            await reanchorAllDayEvents(
                args.db,
                resolveBandTimeZone(oldValue?.value?.trim()),
                await loadBandTimeZone(args.db)
            );
        }
    };
    if (args.value === null || args.value === undefined || args.value === "") {
        if (!oldValue) return null;
        await args.db.setting.delete({ where: { id: oldValue.id } });
        // await RegisterChange({
        //     action: ChangeAction.delete,
        //     changeContext: args.changeContext,
        //     table: "setting",
        //     pkid: oldValue.id,
        //     oldValues: oldValue,
        //     auth: args.auth,
        //     db: args.db,
        // });
        await refreshBounds();
        return null;
    }

    if (oldValue) {
        if (oldValue.value === args.value) return oldValue;
        const newValue = await args.db.setting.update({
            where: { id: oldValue.id },
            data: { value: args.value },
        });
        // await RegisterChange({
        //     action: ChangeAction.update,
        //     changeContext: args.changeContext,
        //     table: "setting",
        //     pkid: oldValue.id,
        //     oldValues: oldValue,
        //     newValues: newValue,
        //     auth: args.auth,
        //     db: args.db,
        // });
        await refreshBounds();
        return newValue;
    }

    const value = args.value;
    const settingDelegate = args.db.setting as Prisma.SettingDelegate; // The transactional client preserves Prisma's Setting delegate.
    const newValue = await db3Server.table(xSetting).createWithPublicId(publicId =>
        settingDelegate.create({
            data: { publicId, name: args.name, value },
        }));
    // await RegisterChange({
    //     action: ChangeAction.insert,
    //     changeContext: args.changeContext,
    //     table: "setting",
    //     pkid: newValue.id,
    //     newValues: newValue,
    //     auth: args.auth,
    //     db: args.db,
    // });
    await refreshBounds();
    return newValue;
};
