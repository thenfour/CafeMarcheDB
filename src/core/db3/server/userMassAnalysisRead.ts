import { Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import { getPermissionDefinition, isPermission, Permission } from "shared/permissions";
import { parsePublicId, type UserPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { resolveAuthorizedDynamicStrings } from "src/locale/server/localization";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import type {
    UserAccountAnalysisChoice, UserMassAnalysisContentCounts, UserMassAnalysisMembership, UserMassAnalysisParticipationCounts,
    UserMassAnalysisResult
} from "../shared/getUserMassAnalysisTypes";
import { assessUserDependencyRisk, measureUserActivity } from "../shared/userDependencyRisk";
import { executeDB3Read, type DB3ReadContext, type DB3ReadDatabase } from "./db3ReadExecution";

const accountSelection = Prisma.validator<Prisma.UserSelect>()({
    id: true,
    publicId: true,
    name: true,
    email: true,
    createdAt: true,
    isSysAdmin: true,
    isDeleted: true,
    mergedAt: true,
    mergedIntoUser: {
        select: {
            publicId: true
        }
    },
    globalRole: {
        select: {
            publicId: true,
            nameId: true,
            isDeleted: true,
            permissions: {
                select: {
                    permission: {
                        select: {
                            name: true,
                            isDeleted: true
                        }
                    }
                }
            }
        }
    },
    _count: {
        select: {
            songsByCreatedByUser: true,
            creatorForEvents: true,
            creatorForWikiPages: true,
            creatorForFrontpageGalleryItem: true,
            uploadedFiles: true,
            createdMenuLinks: true,
            createdCustomLinks: true,
            songCredits: true,
            setlistPlans: true,
            createdWikiPageRevisions: true,
            actions: true,
            sessions: true,
            tokens: true,
            changes: true,
            signInMethods: true,
            userSettingsByUser: true,
        }
    },
});
const membershipSelection = Prisma.validator<Prisma.BandUserSelect>()({
    publicId: true, isDeleted: true, createdAt: true,
    band: {
        select: {
            id: true,
            publicId: true,
            nameId: true,
            isDeleted: true
        }
    },
    bandRole: {
        select: {
            publicId: true,
            nameId: true,
            isDeleted: true
        }
    },
    _count: {
        select: {
            eventUserResponses: true,
            eventSegmentUserResponses: true,
            fileUserTags: true,
            bandUserInstruments: true,
            bandUserTagAssignments: true,
            bandUserSettings: true
        }
    },
});

type StoredMembership = Prisma.BandUserGetPayload<{ select: typeof membershipSelection }>;
type StoredAccount = Prisma.UserGetPayload<{ select: typeof accountSelection }>;

async function presentMembership(database: Prisma.TransactionClient, membership: StoredMembership,
    locale: LocalePreferenceInput,
): Promise<UserMassAnalysisMembership> {
    const stringIds = [membership.band.nameId, ...(membership.bandRole ? [membership.bandRole.nameId] : [])];
    // Sysadmin inventory already authorized these records, including retired bands and roles.
    const labels = await resolveAuthorizedDynamicStrings(database, { band: membership.band }, stringIds, locale);
    return {
        publicId: parsePublicId<"BandUser">(membership.publicId),
        bandPublicId: parsePublicId<"Band">(membership.band.publicId),
        bandName: labels.get(membership.band.nameId)?.value ?? null,
        bandIsDeleted: membership.band.isDeleted, isDeleted: membership.isDeleted, createdAt: membership.createdAt,
        roleId: membership.bandRole ? parsePublicId<"BandRole">(membership.bandRole.publicId) : null,
        roleName: membership.bandRole ? labels.get(membership.bandRole.nameId)?.value ?? null : null,
        roleIsDeleted: membership.bandRole?.isDeleted ?? false,
        counts: {
            eventResponses: membership._count.eventUserResponses,
            eventSegmentResponses: membership._count.eventSegmentUserResponses,
            taggedFiles: membership._count.fileUserTags,
            instruments: membership._count.bandUserInstruments,
            userTags: membership._count.bandUserTagAssignments,
            settings: membership._count.bandUserSettings,
        },
    };
}

async function loadAccountInventory(database: Prisma.TransactionClient, userId: UserPublicId, locale: LocalePreferenceInput) {
    // Administrative existence counts intentionally include hidden/deleted content and inactive/merged targets.
    // Ordinary domain readers must keep their own row policy; no domain contents or credentials leave this reader.
    const account = await database.user.findUnique({ where: { publicId: userId }, select: accountSelection });
    if (!account) {
        throw new NotFoundError();
    }
    const now = new Date();
    const [storedMemberships, lastAction, googleMethods, activeSessions, roleLabels] = await Promise.all([
        database.bandUser.findMany({
            where: { userId: account.id },
            select: membershipSelection,
            orderBy: { publicId: "asc" }
        }),
        database.action.findFirst({
            where: { userId: account.id },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
        }),
        database.userSignInMethod.count({
            where: { userId: account.id, type: "google" }
        }),
        database.session.count({
            where: {
                userId: account.id, OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } }
                ]
            }
        }),
        resolveAuthorizedDynamicStrings(database, { band: null },
            account.globalRole ? [account.globalRole.nameId] : [], locale),
    ]);
    return { account, storedMemberships, lastAction, googleMethods, activeSessions, roleLabels, now };
}

function accountContentCounts(account: StoredAccount): UserMassAnalysisContentCounts {
    return {
        createdSongs: account._count.songsByCreatedByUser,
        createdEvents: account._count.creatorForEvents,
        createdWikiPages: account._count.creatorForWikiPages,
        createdGalleryItems: account._count.creatorForFrontpageGalleryItem,
        uploadedFiles: account._count.uploadedFiles,
        createdMenuLinks: account._count.createdMenuLinks,
        createdCustomLinks: account._count.createdCustomLinks,
        songCredits: account._count.songCredits,
        setlistPlans: account._count.setlistPlans,
        wikiPageRevisions: account._count.createdWikiPageRevisions,
    };
}

function aggregateMembershipCounts(memberships: readonly UserMassAnalysisMembership[]): UserMassAnalysisParticipationCounts {
    return {
        eventResponses: memberships.reduce((sum, membership) => sum + membership.counts.eventResponses, 0),
        eventSegmentResponses: memberships.reduce((sum, membership) => sum + membership.counts.eventSegmentResponses, 0),
        taggedFiles: memberships.reduce((sum, membership) => sum + membership.counts.taggedFiles, 0),
        instruments: memberships.reduce((sum, membership) => sum + membership.counts.instruments, 0),
        userTags: memberships.reduce((sum, membership) => sum + membership.counts.userTags, 0),
    };
}

function accountRiskProtection(account: StoredAccount) {
    const grants = account.globalRole && !account.globalRole.isDeleted
        ? account.globalRole.permissions.filter(grant => !grant.permission.isDeleted).map(grant => grant.permission.name) : [];
    // A flagged administrator stays protected even if its designated grant is temporarily invalid.
    return {
        isProtectedAdministrator: account.isSysAdmin || grants.includes(Permission.sysadmin),
        // Global roles can also grant authority across selected bands, beyond ordinary account access.
        hasElevatedGlobalRole: grants.some(name => {
            if (!isPermission(name)) {
                return false;
            }
            const scope = getPermissionDefinition(name).scope;
            return scope === "platform" || scope === "band";
        })
    };
}

async function presentAccountInventory(database: Prisma.TransactionClient,
    inventory: Awaited<ReturnType<typeof loadAccountInventory>>, locale: LocalePreferenceInput,
): Promise<UserMassAnalysisResult> {
    const { account, storedMemberships, lastAction, googleMethods, activeSessions, roleLabels, now } = inventory;
    const memberships = await Promise.all(storedMemberships.map(membership => presentMembership(database, membership, locale)));
    const contentCounts = accountContentCounts(account);
    const participationCounts = aggregateMembershipCounts(memberships);
    const { isProtectedAdministrator, hasElevatedGlobalRole } = accountRiskProtection(account);
    const activityMetrics = measureUserActivity(account.createdAt, lastAction?.createdAt ?? null, account._count.actions, now);
    const globalRoleName = account.globalRole ? roleLabels.get(account.globalRole.nameId)?.value ?? null : null;
    return {
        userInfo: {
            publicId: parsePublicId<"User">(account.publicId),
            name: account.name,
            email: account.email,
            createdAt: account.createdAt,
            isSysAdmin: account.isSysAdmin,
            isProtectedAdministrator,
            isDeleted: account.isDeleted,
            globalRoleId: account.globalRole ? parsePublicId<"GlobalRole">(account.globalRole.publicId) : null,
            globalRoleName,
            globalRoleIsDeleted: account.globalRole?.isDeleted ?? false,
            mergedIntoUserId: account.mergedIntoUser ? parsePublicId<"User">(account.mergedIntoUser.publicId) : null,
            mergedAt: account.mergedAt,
            hasGoogleIdentity: googleMethods > 0,
        },
        contentCounts,
        participationCounts,
        memberships,
        systemCounts: {
            actions: account._count.actions,
            sessions: account._count.sessions,
            tokens: account._count.tokens,
            changes: account._count.changes,
            signInMethods: account._count.signInMethods,
            userSettings: account._count.userSettingsByUser
        },
        activityMetrics,
        riskAssessment: assessUserDependencyRisk({
            isProtectedAdministrator,
            hasElevatedGlobalRole,
            globalRoleName,
            isMerged: account.mergedIntoUser !== null,
            activeSessions,
            contentCounts,
            participationCounts,
            activityMetrics
        }),
    };
}

async function readAuthorizedInventory(context: DB3ReadContext, userId: UserPublicId, locale: LocalePreferenceInput): Promise<UserMassAnalysisResult> {
    context.authorization.requireUser().requirePermission(Permission.sysadmin);
    return readAccountDependencyInventory(context.database, userId, locale);
}

/** Internal inventory composition. The feature owner must authorize its account-wide read first. */
export async function readAccountDependencyInventory(database: Prisma.TransactionClient, userId: UserPublicId,
    locale: LocalePreferenceInput,
): Promise<UserMassAnalysisResult> {
    const inventory = await loadAccountInventory(database, userId, locale);
    return presentAccountInventory(database, inventory, locale);
}

export function readUserMassAnalysis(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    userId: UserPublicId, locale: LocalePreferenceInput,
): Promise<UserMassAnalysisResult> {
    return executeDB3Read(database, authorization, context => readAuthorizedInventory(context, userId, locale));
}

/** Comparison has report authority, independently of the platform grid's account-edit grant. */
export function readUserAccountAnalysisChoices(database: DB3ReadDatabase,
    authorization: CMServerAuthorization,
): Promise<UserAccountAnalysisChoice[]> {
    return executeDB3Read(database, authorization, async context => {
        context.authorization.requireUser().requirePermission(Permission.sysadmin);
        const accounts = await context.database.user.findMany({
            select: {
                publicId: true,
                name: true, email: true,
                isDeleted: true
            },
            orderBy: [
                { name: "asc" },
                { publicId: "asc" }
            ],
        });
        return accounts.map(account => ({ ...account, publicId: parsePublicId<"User">(account.publicId) }));
    });
}
