import { z } from "zod";
import type { GlobalRolePublicId, UserPublicId } from "shared/publicId";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";
import { UserPublicIdSchema } from "./schemas";
import type { accountMergeStaticStrings } from "src/locale/shared/accountMergeStrings";

export const UserMergeInput = z.object({ mainUserId: UserPublicIdSchema, retiringUserId: UserPublicIdSchema }).strict()
    .refine(input => input.mainUserId !== input.retiringUserId, "Choose two different accounts.");
export const MergePresentationInput = PresentationInputSchema.omit({ bandPublicId: true });
export type UserMergePresentation = z.infer<typeof MergePresentationInput>;
export const PreviewUserMergeInput = MergePresentationInput.extend({ participants: UserMergeInput }).strict();
export const CommitUserMergeInput = PreviewUserMergeInput.extend({ confirmation: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const SearchUserMergeCandidatesInput = MergePresentationInput.extend({ query: z.string().trim().max(150), excludeUserId: UserPublicIdSchema }).strict();
export const MergeAccountAnalysisInput = MergePresentationInput.extend({ userId: UserPublicIdSchema }).strict();
export type UserMergeParticipants = z.infer<typeof UserMergeInput>;
export type UserMergeDatabaseParticipants = { mainUserId: number; retiringUserId: number };

// This is the disclosure contract. Detailed policy state and credentials stay on the server.
export interface MergeIdentity {
    publicId: UserPublicId;
    name: string;
    email: string;
    createdAt: Date;
    roleId: GlobalRolePublicId | null;
    roleName: string | null;
    isDeleted: boolean;
    isSysAdmin: boolean;
}
export type MergeReportText = string | { readonly key: keyof typeof accountMergeStaticStrings };
export interface MergeReportSection {
    key: string;
    title: MergeReportText;
    policy: MergeReportText;
    effects: { label: MergeReportText; count: number }[];
    consequences?: MergeReportText[];
    blockers?: string[];
}
export interface UserMergePreview {
    policyVersion: number;
    main: MergeIdentity;
    retiring: MergeIdentity;
    sections: MergeReportSection[];
    canCommit: boolean;
    confirmation: string;
}
