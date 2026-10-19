import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import { loadDefaultAccountRole } from "src/auth/server/accountRoleDefaults";
import { parsePublicId } from "shared/publicId";
import { userEditorView } from "../../shared/entities/user/userViews";
import { platformUserEditorView, xPlatformUser } from "../../shared/entities/user/platformUser";
import { xUser } from "../../shared/schema/user";
import { defineCommandHandler, type DB3CommandExecutionContext } from "../db3CommandCore";

async function createUserAccount(entity: typeof xUser | typeof xPlatformUser,
    // Both descriptor commands validate their own fields before this shared account lifecycle step.
    values: Record<string, unknown>, context: DB3CommandExecutionContext,
) {
    const role = await loadDefaultAccountRole(context.transaction);
    const created = await context.rowServices.insert(entity, values);
    const identity = parsePublicId<"User">(created.publicId);
    const account = await context.transaction.user.update({
        where: { publicId: identity },
        data: { globalRoleId: role.id, isSysAdmin: role.isSysAdmin },
    });
    await RegisterChange({
        action: ChangeAction.update,
        changeContext: CreateChangeContext("assignInitialAccountRole"),
        table: "User", pkid: account.id,
        oldValues: { globalRoleId: null, isSysAdmin: created.isSysAdmin },
        newValues: { globalRoleId: role.id, isSysAdmin: role.isSysAdmin },
        auth: context.authorization, db: context.transaction,
    });
    return { identity };
}

export const userAccountCreateCommandHandler = defineCommandHandler(userEditorView.crud.operations.create.command,
    (dto, context) => createUserAccount(xUser, dto, context));

export const platformUserAccountCreateCommandHandler = defineCommandHandler(platformUserEditorView.crud.operations.create.command,
    (dto, context) => createUserAccount(xPlatformUser, dto, context));
