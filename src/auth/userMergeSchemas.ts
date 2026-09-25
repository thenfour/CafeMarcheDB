import { z } from "zod";
import type { RolePublicId } from "shared/publicId";

export const UserMergeInput = z.object({
    mainUserId: z.number().int().positive(),
    retiringUserId: z.number().int().positive(),
}).strict().refine(input => input.mainUserId !== input.retiringUserId, "Choose two different accounts.");

export const CommitUserMergeInput = z.object({
    participants: UserMergeInput,
    confirmation: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type UserMergeParticipants = z.infer<typeof UserMergeInput>;

// This is the entire disclosure contract. Detailed plans never cross the RPC boundary.
export interface MergeIdentity {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
    roleId: RolePublicId | null;
    isDeleted: boolean;
    isSysAdmin: boolean;
}

export interface MergeReportSection {
    key: string;
    title: string;
    policy: string;
    effects: { label: string; count: number }[];
    consequences?: string[];
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
