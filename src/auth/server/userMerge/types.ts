import type { Prisma } from "db";
import type { MergeReportSection, UserMergeParticipants } from "../../userMergeSchemas";


// types and utilities shared by merge policies

export type MergeDatabase = Prisma.TransactionClient;

export type MergeUser = Prisma.UserGetPayload<{
    include: { role: { include: { permissions: { include: { permission: true } } } } }
}>;

export interface MergeContext extends UserMergeParticipants {
    db: MergeDatabase;
    main: MergeUser;
    retiring: MergeUser;
}

export interface PreparedMergeStep {
    report: MergeReportSection;
    // Used only on the server to bind confirmation to the data that was reviewed.
    reviewState: unknown;
    apply: (db: MergeDatabase) => Promise<void>;
}

export interface MergePolicy {
    key: string;
    // Every foreign key to User must have an intentional disposition.
    // and should never be covered by more than one policy.
    // so this has a unit test ensuring no overlap between policies.
    userRelations: readonly string[];
    prepare: (context: MergeContext) => Promise<PreparedMergeStep>;
}

// pass-through to change shape from "x", y to { label: "x", count: y }
export const countEffect = (label: string, count: number) => ({ label, count });

// prisma where clause for selecting participants in a user merge
export const participantWhere = (context: UserMergeParticipants) => ({
    userId: { in: [context.mainUserId, context.retiringUserId] },
});
