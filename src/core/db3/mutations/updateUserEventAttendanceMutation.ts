import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, AuthorizationError, NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { CreatePublicData, PublicDataType } from "types";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import {
    TupdateUserEventAttendanceMutationArgs,
    ZupdateUserEventAttendanceMutationArgs,
} from "../shared/apiTypes";

export class EventAttendanceAuthorizationError extends AuthorizationError {
    constructor(permission: Permission) {
        super();
        this.message = `Not authorized to update event attendance; required: ${permission}.`;
        this.name = "EventAttendanceAuthorizationError";
    }
}

const requireFreshPermission = (publicData: PublicDataType, permission: Permission): void => {
    if (!publicData.isSysAdmin && !publicData.permissions.includes(permission)) {
        throw new EventAttendanceAuthorizationError(permission);
    }
};

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ZupdateUserEventAttendanceMutationArgs),
    async (args: TupdateUserEventAttendanceMutationArgs, ctx: AuthenticatedCtx) => {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        if (!currentUser) throw new EventAttendanceAuthorizationError(Permission.login);

        const publicData = CreatePublicData({ user: currentUser });
        const hasResponseMutation = args.comment !== undefined
            || args.instrumentId !== undefined
            || Object.keys(args.segmentResponses || {}).length > 0;
        if (hasResponseMutation) {
            const isSelf = currentUser.id === args.userId;
            requireFreshPermission(
                publicData,
                isSelf ? Permission.respond_to_events : Permission.change_others_event_responses,
            );
        }
        if (args.isInvited !== undefined) {
            requireFreshPermission(publicData, Permission.manage_events);
        }

        const clientIntention: db3.xTableClientUsageContext = {
            intention: currentUser.isSysAdmin ? "admin" : "user",
            mode: "primary",
            currentUser,
        };
        const segmentIds = Object.keys(args.segmentResponses || {}).map(Number);
        const changeContext = CreateChangeContext("updateUserEventAttendance");
        await db.$transaction(async transactionalDb => {
            const [event, targetUser, eventSegments] = await Promise.all([
                transactionalDb.event.findFirst({
                    where: { id: args.eventId, isDeleted: false },
                    include: { visiblePermission: { include: { roles: true } } },
                }),
                transactionalDb.user.findFirst({
                    where: { id: args.userId, isDeleted: false },
                    select: { id: true },
                }),
                segmentIds.length === 0
                    ? Promise.resolve([])
                    : transactionalDb.eventSegment.findMany({
                        where: {
                            id: { in: segmentIds },
                            eventId: args.eventId,
                        },
                        select: { id: true, eventId: true },
                    }),
            ]);

            if (!event
                || !db3.xEvent.authorizeRowForView({ model: event, publicData, clientIntention })) {
                throw new NotFoundError();
            }
            if (!targetUser || eventSegments.length !== segmentIds.length) {
                throw new NotFoundError();
            }

            let didSegmentChangesOccur = false;

            for (const eventSegmentId of segmentIds) {
                const attendanceId = args.segmentResponses![eventSegmentId]!.attendanceId;
                const existing = await transactionalDb.eventSegmentUserResponse.findFirst({
                    where: { userId: args.userId, eventSegmentId },
                });

                if (existing?.attendanceId === attendanceId) continue;

                if (existing) {
                    const updated = await transactionalDb.eventSegmentUserResponse.update({
                        where: { id: existing.id },
                        data: {
                            attendanceId,
                            updatedByUserId: currentUser.id,
                        },
                    });
                    await RegisterChange({
                        action: ChangeAction.update,
                        changeContext,
                        table: db3.xEventSegmentUserResponse.tableName,
                        pkid: existing.id,
                        oldValues: existing,
                        newValues: updated,
                        ctx,
                        db: transactionalDb,
                    });
                    await mutationCore.CallMutateEventHooks({
                        tableNameOrSpecialMutationKey: db3.xEventSegmentUserResponse.tableName,
                        model: updated,
                        db: transactionalDb,
                    });
                } else {
                    const fields: Prisma.EventSegmentUserResponseUncheckedCreateInput = {
                        userId: args.userId,
                        eventSegmentId,
                        attendanceId,
                        createdByUserId: currentUser.id,
                        updatedByUserId: currentUser.id,
                    };
                    const inserted = await transactionalDb.eventSegmentUserResponse.create({
                        data: fields,
                    });
                    await RegisterChange({
                        action: ChangeAction.insert,
                        changeContext,
                        table: db3.xEventSegmentUserResponse.tableName,
                        pkid: inserted.id,
                        newValues: inserted,
                        ctx,
                        db: transactionalDb,
                    });
                    await mutationCore.CallMutateEventHooks({
                        tableNameOrSpecialMutationKey: db3.xEventSegmentUserResponse.tableName,
                        model: inserted,
                        db: transactionalDb,
                    });
                }
                didSegmentChangesOccur = true;
            }

            const existingEventResponse = await transactionalDb.eventUserResponse.findFirst({
                where: { userId: args.userId, eventId: args.eventId },
            });

            if (existingEventResponse) {
                const desired: Prisma.EventUserResponseUncheckedUpdateInput = {};
                let isEventResponseDifferent = false;
                if (args.comment !== undefined) {
                    desired.userComment = args.comment;
                    isEventResponseDifferent ||= args.comment !== existingEventResponse.userComment;
                }
                if (args.instrumentId !== undefined) {
                    desired.instrumentId = args.instrumentId;
                    isEventResponseDifferent ||= args.instrumentId !== existingEventResponse.instrumentId;
                }
                if (args.isInvited !== undefined) {
                    desired.isInvited = args.isInvited;
                    isEventResponseDifferent ||= args.isInvited !== existingEventResponse.isInvited;
                }

                if (isEventResponseDifferent || didSegmentChangesOccur) {
                    desired.revision = existingEventResponse.revision + 1;
                    const updated = await transactionalDb.eventUserResponse.update({
                        where: { id: existingEventResponse.id },
                        data: desired,
                    });
                    await RegisterChange({
                        action: ChangeAction.update,
                        changeContext,
                        table: db3.xEventUserResponse.tableName,
                        pkid: existingEventResponse.id,
                        oldValues: existingEventResponse,
                        newValues: updated,
                        ctx,
                        db: transactionalDb,
                    });
                }
            } else {
                const fields: Prisma.EventUserResponseUncheckedCreateInput = {
                    userId: args.userId,
                    eventId: args.eventId,
                    userComment: args.comment || "",
                    instrumentId: args.instrumentId,
                    isInvited: args.isInvited,
                    revision: 1,
                };
                const inserted = await transactionalDb.eventUserResponse.create({ data: fields });
                await RegisterChange({
                    action: ChangeAction.insert,
                    changeContext,
                    table: db3.xEventUserResponse.tableName,
                    pkid: inserted.id,
                    newValues: inserted,
                    ctx,
                    db: transactionalDb,
                });
            }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        return args;
    },
);
