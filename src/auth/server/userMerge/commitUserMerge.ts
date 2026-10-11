import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { UserPublicId } from "shared/publicId";
import { parsePublicId } from "shared/publicId";
import { ChangeAction, CreateChangeContext, RegisterChange } from "../activityLog";
import type { CommitUserMergeInput, UserMergePreview } from "../../userMergeSchemas";
import { prepareUserMerge } from "./prepareUserMerge";
import { UserMergeError } from "./publicResponse";
import type { MergeAuthority, MergeContext, MergeDatabase, MergeRootDatabase, PreparedMergeStep } from "./types";
export const MERGE_REVIEW_CHANGED = "The accounts changed since this report was prepared. Refresh the report before merging.";
export const MERGE_TRANSACTION_CONFLICT = "The merge conflicted with another operation. Refresh the report and try again.";

function requireAcceptedReport(preview: UserMergePreview, confirmation: string): void {
    if (preview.confirmation !== confirmation) {
        throw new UserMergeError(MERGE_REVIEW_CHANGED);
    }
    if (!preview.canCommit) {
        throw new UserMergeError("Resolve the report's blockers before merging.");
    }
}

async function applyMergePolicies(database: MergeDatabase, steps: readonly PreparedMergeStep[]): Promise<void> {
    for (const step of steps) {
        await step.apply(database);
    }
}

async function retireMergedAccount(database: MergeDatabase, context: MergeContext): Promise<void> {
    await database.user.update({
        where: { id: context.retiringUserId },
        data: {
            isDeleted: true, mergedIntoUserId: context.mainUserId, mergedAt: new Date(),
            hashedPassword: null, calendarFeedToken: null,
        },
    });
}

async function recordMergeAudit(database: MergeDatabase, context: MergeContext, preview: UserMergePreview): Promise<void> {
    await RegisterChange({
        action: ChangeAction.update, changeContext: CreateChangeContext("mergeUsers"), table: "User", pkid: context.retiringUserId,
        oldValues: {},
        newValues: {
            mainUserId: context.main.publicId, retiringUserId: context.retiring.publicId,
            policyVersion: preview.policyVersion, sections: preview.sections,
        },
        options: { dontCalculateChanges: true }, auth: context.authorization, db: database,
    });
}

export async function commitUserMerge(database: MergeRootDatabase, authority: MergeAuthority, input: z.infer<typeof CommitUserMergeInput>): Promise<{ mainUserId: UserPublicId }> {
    try {
        return await database.$transaction(async tx => {
            const { context, steps, preview } = await prepareUserMerge(tx, authority, input.participants, input);
            requireAcceptedReport(preview, input.confirmation);
            await applyMergePolicies(tx, steps);
            await retireMergedAccount(tx, context);
            await recordMergeAudit(tx, context, preview);
            return { mainUserId: parsePublicId<"User">(context.main.publicId) };
        }, { isolationLevel: "Serializable", timeout: 30_000, maxWait: 10_000 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
            throw new UserMergeError(MERGE_TRANSACTION_CONFLICT);
        }
        throw error;
    }
}
