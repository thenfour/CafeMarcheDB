import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";

export type UserMassAnalysisResult = {
    userInfo: {
        id: number;
        name: string;
        email: string;
        createdAt: Date;
        isSysAdmin: boolean;
        isDeleted: boolean;
        roleId: number | null;
        roleName: string | null;
        googleId: string | null;
    };
    contentCounts: {
        createdSongs: number;
        createdEvents: number;
        createdWikiPages: number;
        createdGalleryItems: number;
        uploadedFiles: number;
        createdMenuLinks: number;
        createdCustomLinks: number;
        songCredits: number;
        setlistPlans: number;
        wikiPageRevisions: number;
    };
    participationCounts: {
        eventResponses: number;
        eventSegmentResponses: number;
        workflowAssignments: number;
        workflowLogItems: number;
        taggedFiles: number;
        instruments: number;
        userTags: number;
    };
    systemCounts: {
        actions: number;
        sessions: number;
        tokens: number;
        changes: number;
    };
    activityMetrics: {
        accountAgeInDays: number;
        hasEverLoggedIn: boolean;
        lastActivityDate: Date | null;
        daysSinceLastActivity: number | null;
    };
    riskAssessment: {
        safeToDelete: boolean;
        riskLevel: 'low' | 'medium' | 'high';
        warnings: string[];
        blockers: string[];
    };
};

export default resolver.pipe(
    resolver.authorize(Permission.manage_users),
    resolver.zod(z.object({ userId: z.number() })),
    async (args, ctx: AuthenticatedCtx): Promise<UserMassAnalysisResult> => {
        const userId = args.userId;

        // Get basic user info with role
        const user = await db.user.findUnique({
            where: { id: userId },
            include: {
                role: {
                    select: { name: true }
                }
            }
        });

        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }

        // Get content counts in parallel
        const [
            createdSongs,
            createdEvents,
            createdWikiPages,
            createdGalleryItems,
            uploadedFiles,
            createdMenuLinks,
            createdCustomLinks,
            songCredits,
            setlistPlans,
            wikiPageRevisions,
            eventResponses,
            eventSegmentResponses,
            workflowAssignments,
            workflowLogItems,
            taggedFiles,
            instruments,
            userTags,
            actions,
            sessions,
            tokens,
            changes,
        ] = await Promise.all([
            // Content creation counts
            db.song.count({ where: { createdByUserId: userId } }),
            db.event.count({ where: { createdByUserId: userId } }),
            db.wikiPage.count({ where: { createdByUserId: userId } }),
            db.frontpageGalleryItem.count({ where: { createdByUserId: userId } }),
            db.file.count({ where: { uploadedByUserId: userId } }),
            db.menuLink.count({ where: { createdByUserId: userId } }),
            db.customLink.count({ where: { createdByUserId: userId } }),
            db.songCredit.count({ where: { userId: userId } }),
            db.setlistPlan.count({ where: { createdByUserId: userId } }),
            db.wikiPageRevision.count({ where: { createdByUserId: userId } }),

            // Participation counts
            db.eventUserResponse.count({ where: { userId: userId } }),
            db.eventSegmentUserResponse.count({ where: { userId: userId } }),
            db.workflowInstanceNodeAssignee.count({ where: { userId: userId } }),
            db.workflowInstanceLogItem.count({ where: { userId: userId } }),
            db.fileUserTag.count({ where: { userId: userId } }),
            db.userInstrument.count({ where: { userId: userId } }),
            db.userTagAssignment.count({ where: { userId: userId } }),

            // System counts
            db.action.count({ where: { userId: userId } }),
            db.session.count({ where: { userId: userId } }),
            db.token.count({ where: { userId: userId } }),
            db.change.count({ where: { userId: userId } }),
        ]);

        // Calculate activity metrics
        const now = new Date();
        const accountAgeInDays = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

        // Get last action date for activity calculation
        const lastAction = await db.action.findFirst({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });

        const lastActivityDate = lastAction?.createdAt || null;
        const daysSinceLastActivity = lastActivityDate
            ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // Calculate risk assessment
        const warnings: string[] = [];
        const blockers: string[] = [];

        if (user.isSysAdmin) {
            blockers.push("User is a system administrator");
        }

        if (user.role?.name && !['Member', 'Guest'].includes(user.role.name)) {
            warnings.push(`User has elevated role: ${user.role.name}`);
        }

        const totalContent = createdSongs + createdEvents + createdWikiPages + createdGalleryItems + uploadedFiles;
        const totalParticipation = eventResponses + eventSegmentResponses + songCredits;

        if (totalContent > 10) {
            warnings.push(`User has created ${totalContent} content items`);
        }

        if (totalParticipation > 20) {
            warnings.push(`User has ${totalParticipation} participation records`);
        }

        if (daysSinceLastActivity !== null && daysSinceLastActivity < 30) {
            warnings.push(`User was active ${daysSinceLastActivity} days ago`);
        }

        if (sessions > 0) {
            warnings.push("User has active sessions");
        }

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        if (blockers.length > 0) {
            riskLevel = 'high';
        } else if (warnings.length > 2 || totalContent > 5 || totalParticipation > 10) {
            riskLevel = 'medium';
        }

        const safeToDelete = blockers.length === 0 && riskLevel === 'low';

        return {
            userInfo: {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,
                isSysAdmin: user.isSysAdmin,
                isDeleted: user.isDeleted,
                roleId: user.roleId,
                roleName: user.role?.name || null,
                googleId: user.googleId,
            },
            contentCounts: {
                createdSongs,
                createdEvents,
                createdWikiPages,
                createdGalleryItems,
                uploadedFiles,
                createdMenuLinks,
                createdCustomLinks,
                songCredits,
                setlistPlans,
                wikiPageRevisions,
            },
            participationCounts: {
                eventResponses,
                eventSegmentResponses,
                workflowAssignments,
                workflowLogItems,
                taggedFiles,
                instruments,
                userTags,
            },
            systemCounts: {
                actions,
                sessions,
                tokens,
                changes,
            },
            activityMetrics: {
                accountAgeInDays,
                hasEverLoggedIn: actions > 0,
                lastActivityDate,
                daysSinceLastActivity,
            },
            riskAssessment: {
                safeToDelete,
                riskLevel,
                warnings,
                blockers,
            },
        };
    }
);
