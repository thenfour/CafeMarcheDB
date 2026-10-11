import { SplitQuickFilter } from "shared/quickFilter";
import type { z } from "zod";
import { executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import { readAccountDependencyInventory } from "src/core/db3/server/userMassAnalysisRead";
import type { MergeAccountAnalysisInput, PreviewUserMergeInput, SearchUserMergeCandidatesInput } from "../../userMergeSchemas";
import { authorizeMergeActor, canMergeAccount, loadEligibleMergeUser, mergeIdentity } from "./mergeEligibility";
import { prepareUserMerge } from "./prepareUserMerge";
import { mergeCandidateSelect, type MergeAuthority } from "./types";
export function previewMerge(database: DB3ReadDatabase, authority: MergeAuthority, input: z.infer<typeof PreviewUserMergeInput>) {
    return executeDB3Read(database, authority.authorization, async context => (await prepareUserMerge(context.database,
        { ...authority, authorization: context.authorization }, input.participants, input)).preview);
}
export function searchMergeCandidates(database: DB3ReadDatabase, authority: MergeAuthority, input: z.infer<typeof SearchUserMergeCandidatesInput>) {
    return executeDB3Read(database, authority.authorization, async context => {
        const actor = await authorizeMergeActor(context.database, { ...authority, authorization: context.authorization });
        await loadEligibleMergeUser(context.database, actor, input.excludeUserId);
        const accounts = await context.database.user.findMany({ where: { publicId: { notIn: [input.excludeUserId, actor.auth.requireUser().user.publicId] }, mergedIntoUserId: null,
            // Use the canonical tokenizer: every word can match any permitted identity field.
            AND: SplitQuickFilter(input.query).map(word => ({ OR: [{ name: { contains: word } }, { email: { contains: word } }, { publicId: { contains: word } }] })),
        }, select: mergeCandidateSelect, orderBy: [{ name: "asc" }, { publicId: "asc" }] });
        const eligible = accounts.filter(account => canMergeAccount(actor, account)).slice(0, 100);
        return Promise.all(eligible.map(account => mergeIdentity(context.database, account, input)));
    });
}
export function readMergeAccountAnalysis(database: DB3ReadDatabase, authority: MergeAuthority, input: z.infer<typeof MergeAccountAnalysisInput>) {
    return executeDB3Read(database, authority.authorization, async context => {
        const actor = await authorizeMergeActor(context.database, { ...authority, authorization: context.authorization });
        await loadEligibleMergeUser(context.database, actor, input.userId);
        return readAccountDependencyInventory(context.database, input.userId, input);
    });
}
