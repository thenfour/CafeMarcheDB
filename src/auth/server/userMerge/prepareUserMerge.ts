import { createHmac } from "crypto";
import type { UserMergeParticipants, UserMergePreview } from "../../userMergeSchemas";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { loadMergeContext, mergeIdentity } from "./mergeEligibility";
import { USER_MERGE_POLICY_VERSION, userMergePolicies } from "./policies";
import type { MergeAuthority, MergeDatabase, PreparedMergeStep } from "./types";

// Policies supply different internal state shapes. HMAC binds them without exposing hidden values.
function confirmationHash(state: unknown): string {
    const secret = process.env.SESSION_SECRET_KEY;
    if (!secret) {
        throw new Error("Session signing is not configured.");
    }
    return createHmac("sha256", secret).update(JSON.stringify(state)).digest("hex");
}
export async function prepareUserMerge(db: MergeDatabase, authority: MergeAuthority, participants: UserMergeParticipants, locale: LocalePreferenceInput) {
    const context = await loadMergeContext(db, authority, participants);
    const steps: PreparedMergeStep[] = [];
    for (const policy of userMergePolicies) {
        steps.push(await policy.prepare(context));
    }
    const sections = steps.map(step => step.report);
    const confirmation = confirmationHash({ version: USER_MERGE_POLICY_VERSION, actorId: context.authorization.userId, participants,
        main: context.main, retiring: context.retiring, sections, states: steps.map(step => step.reviewState) });
    const preview: UserMergePreview = { policyVersion: USER_MERGE_POLICY_VERSION,
        main: await mergeIdentity(db, context.main, locale), retiring: await mergeIdentity(db, context.retiring, locale),
        sections, confirmation, canCommit: sections.every(section => !section.blockers?.length) };
    return { context, steps, preview };
}
