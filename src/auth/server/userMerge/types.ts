import { Prisma } from "@prisma/client";
import type { MergeReportSection, MergeReportText, UserMergeDatabaseParticipants } from "../../userMergeSchemas";
import type { CMServerAuthorization } from "../serverAuthorization";

export type MergeDatabase = Prisma.TransactionClient;
// Only transaction execution is needed from the root Prisma/Blitz client.
export interface MergeRootDatabase {
    $transaction<T>(operation: (database: MergeDatabase) => Promise<T>, options: {
        isolationLevel: "Serializable"; timeout?: number; maxWait?: number;
    }): Promise<T>;
}
export interface MergeAuthority { authorization: CMServerAuthorization; isImpersonating: boolean }
export const mergeUserInclude = Prisma.validator<Prisma.UserInclude>()({
    globalRole: { include: { permissions: { include: { permission: true }, orderBy: { id: "asc" } } } },
    bandUsersByUser: { orderBy: { id: "asc" }, include: {
        band: true, bandRole: { include: { bandRolePermissions: { include: { permission: true }, orderBy: { id: "asc" } } } },
    } },
});
export type MergeUser = Prisma.UserGetPayload<{ include: typeof mergeUserInclude }>;
export const mergeCandidateSelect = Prisma.validator<Prisma.UserSelect>()({
    id: true, publicId: true, name: true, email: true, createdAt: true, isDeleted: true, isSysAdmin: true,
    globalRoleId: true, mergedIntoUserId: true, ...mergeUserInclude,
});
export type MergeCandidate = Prisma.UserGetPayload<{ select: typeof mergeCandidateSelect }>;
export type MergeMembership = MergeUser["bandUsersByUser"][number];
export interface MembershipMerge { main: MergeMembership | null; retiring: MergeMembership }
export interface MergeContext extends UserMergeDatabaseParticipants {
    db: MergeDatabase;
    authorization: CMServerAuthorization;
    main: MergeUser;
    retiring: MergeUser;
    memberships: readonly MembershipMerge[];
}
export interface PreparedMergeStep {
    report: MergeReportSection;
    // Policies own different shapes; this opaque state is hashed, never disclosed.
    reviewState: unknown;
    apply: (db: MergeDatabase) => Promise<void>;
}
export interface MergePolicy {
    key: string;
    // Every foreign key to User or BandUser has exactly one intentional disposition.
    userRelations: readonly string[];
    prepare: (context: MergeContext) => Promise<PreparedMergeStep>;
}
export const countEffect = (label: MergeReportText, count: number) => ({ label, count });
export const participantWhere = (context: UserMergeDatabaseParticipants) => ({ userId: { in: [context.mainUserId, context.retiringUserId] } });
export const membershipWhere = (context: MergeContext) => ({ bandUserId: { in: [
    ...context.main.bandUsersByUser.map(member => member.id), ...context.retiring.bandUsersByUser.map(member => member.id),
] } });
