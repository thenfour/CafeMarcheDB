import type { Ctx } from "@blitzjs/next";
import {
    ChangeAction,
    type ChangeContext,
    RegisterChange,
} from "shared/activityLog";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";

export type SettingValue = {
    id: number;
    name: string;
    value: string;
};

export const writeSettingValue = async (args: {
    db: TransactionalPrismaClient;
    ctx: Ctx;
    changeContext: ChangeContext;
    name: string;
    value: string | null | undefined;
}): Promise<SettingValue | null> => {
    const oldValue = await args.db.setting.findFirst({ where: { name: args.name } });
    const shouldDelete = args.value === null || args.value === undefined || args.value === "";

    if (shouldDelete) {
        if (!oldValue) return null;
        await args.db.setting.delete({ where: { id: oldValue.id } });
        await RegisterChange({
            action: ChangeAction.delete,
            changeContext: args.changeContext,
            table: "setting",
            pkid: oldValue.id,
            oldValues: oldValue,
            ctx: args.ctx,
            db: args.db,
        });
        return null;
    }

    if (oldValue) {
        if (oldValue.value === args.value) return oldValue;
        const newValue = await args.db.setting.update({
            where: { id: oldValue.id },
            data: { value: args.value },
        });
        await RegisterChange({
            action: ChangeAction.update,
            changeContext: args.changeContext,
            table: "setting",
            pkid: oldValue.id,
            oldValues: oldValue,
            newValues: newValue,
            ctx: args.ctx,
            db: args.db,
        });
        return newValue;
    }

    const newValue = await args.db.setting.create({
        data: { name: args.name, value: args.value },
    });
    await RegisterChange({
        action: ChangeAction.insert,
        changeContext: args.changeContext,
        table: "setting",
        pkid: newValue.id,
        newValues: newValue,
        ctx: args.ctx,
        db: args.db,
    });
    return newValue;
};
