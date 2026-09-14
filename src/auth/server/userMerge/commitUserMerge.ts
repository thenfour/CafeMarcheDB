import type { Ctx } from "@blitzjs/next";
import { Prisma, type PrismaClient } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import type { z } from "zod";
import type { CommitUserMergeInput } from "../../userMergeSchemas";
import { authorizeMergeActor } from "./mergeEligibility";
import { prepareUserMerge } from "./prepareUserMerge";
import { UserMergeError } from "./publicResponse";

export const MERGE_REVIEW_CHANGED = "The accounts changed since this report was prepared. Refresh the report before merging.";

type CommitUserMergeResult = {
    mainUserId: number;
};

export async function commitUserMerge(db: PrismaClient, ctx: Ctx, input: z.infer<typeof CommitUserMergeInput>): Promise<CommitUserMergeResult> {
    try {
        return await db.$transaction(async tx => {
            await authorizeMergeActor(tx, ctx);
            //const retiring = await tx.user.findUnique({ where: { id: input.participants.retiringUserId } });

            // // already been performed - not necessary; let the proceeding attempt fail at the hash.
            // if (retiring?.mergedIntoUserId === input.participants.mainUserId
            //     && retiring.mergeConfirmationHash === input.confirmation)//
            // {
            //     return { mainUserId: input.participants.mainUserId };
            // }

            const { context, steps, preview } = await prepareUserMerge(tx, ctx, input.participants);
            if (preview.confirmation !== input.confirmation) {
                // the merge plan has changed since the user reviewed it; reject the merge.
                throw new UserMergeError(MERGE_REVIEW_CHANGED);
            }
            if (!preview.canCommit) {
                throw new UserMergeError("Resolve the report's blockers before merging.");
            }

            // play the merge steps.
            for (const step of steps) {
                await step.apply(tx);
            }

            // mark the retiring user as deleted and merged into the main user.
            await tx.user.update({
                where: { id: context.retiringUserId },
                data: {
                    isDeleted: true, mergedIntoUserId: context.mainUserId, mergedAt: new Date(),
                    mergeConfirmationHash: input.confirmation, hashedPassword: null, calendarFeedToken: null,
                },
            });

            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("mergeUsers"),
                table: "User",
                pkid: context.retiringUserId,
                oldValues: {},
                newValues: {
                    mainUserId: context.mainUserId,
                    retiringUserId: context.retiringUserId,
                    policyVersion: preview.policyVersion,
                    sections: preview.sections,
                },
                options: { dontCalculateChanges: true }, ctx, db: tx,
            });
            return { mainUserId: context.mainUserId };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 10_000 });
    } catch (error) {
        // https://www.prisma.io/docs/orm/v6/reference/error-reference
        // "Transaction failed due to a write conflict or a deadlock. Please retry your transaction"
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
            throw new UserMergeError("Transaction failed due to a write conflict or a deadlock. Please retry your transaction.");
        }
        throw error;
    }
}
