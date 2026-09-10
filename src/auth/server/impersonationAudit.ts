import type { Ctx } from "@blitzjs/next";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";

type ImpersonationAuditEvent = "start" | "stop";

interface RegisterImpersonationAuditArgs {
    ctx: Ctx;
    event: ImpersonationAuditEvent;
    originalActorUserId: number;
    targetUserId: number;
}

export const registerImpersonationAudit = async ({
    ctx,
    event,
    originalActorUserId,
    targetUserId,
}: RegisterImpersonationAuditArgs): Promise<void> => {
    const impersonatedByUserId = event === "start" ? originalActorUserId : null;

    await RegisterChange({
        action: ChangeAction.update,
        changeContext: CreateChangeContext(
            event === "start" ? "impersonateUserMutation" : "stopImpersonatingMutation",
        ),
        table: "User",
        pkid: targetUserId,
        oldValues: {
            impersonatedByUserId: event === "start" ? null : originalActorUserId,
        },
        newValues: { impersonatedByUserId },
        ctx,
        actorUserId: originalActorUserId,
        options: { dontCalculateChanges: true },
    });
};
