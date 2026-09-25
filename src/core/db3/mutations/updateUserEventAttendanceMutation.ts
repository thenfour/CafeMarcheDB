import { db3Server } from "../server/db3Server";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, AuthorizationError, NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { resolvePublicId, resolvePublicIds } from "../server/db3PublicIds";
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

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ZupdateUserEventAttendanceMutationArgs),
    async (args: TupdateUserEventAttendanceMutationArgs, ctx: AuthenticatedCtx) => {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        if (!currentUser) throw new EventAttendanceAuthorizationError(Permission.login);

        const reqAuth = await getRequestAuthorization(ctx.session);
        const publicData = db3.createDB3Authorization(currentUser, reqAuth.effectivePermissions);
        const hasResponseMutation = args.comment !== undefined
            || args.instrumentId !== undefined
            || Object.keys(args.segmentResponses || {}).length > 0;
        if (hasResponseMutation) {
            const isSelf = currentUser.id === args.userId;
            const perm = isSelf ? Permission.respond_to_events : Permission.change_others_event_responses;
            if (!reqAuth.effectivePermissions.includesName(perm)) {
                throw new EventAttendanceAuthorizationError(perm);
            }
        }
        if (args.isInvited !== undefined) {
            const perm = Permission.manage_events;
            if (!reqAuth.effectivePermissions.includesName(perm)) {
                throw new EventAttendanceAuthorizationError(perm);
            }
        }


        const segmentResponses = Object.entries(args.segmentResponses ?? {})
            .map(([publicId, response]) => ({
                publicId: db3.xEventSegment.parseIdentity(publicId),
                attendanceId: response!.attendanceId,
            }));
        const changeContext = CreateChangeContext("updateUserEventAttendance");
        await db.$transaction(async transactionalDb => {
            const eventId = await resolvePublicId(db3.xEvent, args.eventId, publicData, transactionalDb);
            const instrumentId = args.instrumentId == null
                ? args.instrumentId
                : await resolvePublicId(db3.xInstrument, args.instrumentId, publicData, transactionalDb);
            const [event, targetUser, eventSegments] = await Promise.all([
                transactionalDb.event.findFirst({
                    where: { id: eventId, isDeleted: false },
                    include: { visiblePermission: { include: { roles: true } } },
                }),
                transactionalDb.user.findFirst({
                    where: { id: args.userId, isDeleted: false },
                    select: { id: true },
                }),
                segmentResponses.length === 0
                    ? Promise.resolve<Pick<Prisma.EventSegmentGetPayload<{}>, "id" | "publicId" | "eventId">[]>([])
                    : transactionalDb.eventSegment.findMany({
                        where: {
                            publicId: {
                                in: segmentResponses.map(response => response.publicId)
                            },
                            eventId,
                        },
                        select: {
                            id: true,
                            publicId: true,
                            eventId: true

                        },
                    }),
            ]);

            if (!event
                || !db3.xEvent.authorizeRowForView({ model: event, publicData })) {
                throw new NotFoundError();
            }
            if (!targetUser || eventSegments.length !== segmentResponses.length) {
                throw new NotFoundError();
            }

            const attendancePublicIds = [...new Set(segmentResponses
                .flatMap(response => response.attendanceId === null ? [] : [response.attendanceId]))];
            const attendanceIds = await resolvePublicIds(db3.xEventAttendance, attendancePublicIds, publicData, transactionalDb);
            const attendanceIdByPublicId = new Map(attendancePublicIds.map((publicId, index) => [publicId, attendanceIds[index]!]));

            let didSegmentChangesOccur = false;

            for (const response of segmentResponses) {
                const eventSegmentId = eventSegments.find(segment => segment.publicId === response.publicId)!.id;
                const attendancePublicId = response.attendanceId;
                const attendanceId = attendancePublicId === null ? null : attendanceIdByPublicId.get(attendancePublicId)!;
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
                    const fields: Omit<Prisma.EventSegmentUserResponseUncheckedCreateInput, "publicId"> = {
                        userId: args.userId,
                        eventSegmentId,
                        attendanceId,
                        createdByUserId: currentUser.id,
                        updatedByUserId: currentUser.id,
                    };
                    const inserted = await db3Server.table(db3.xEventSegmentUserResponse)
                        .createWithPublicId(publicId =>
                            transactionalDb.eventSegmentUserResponse.create({
                                data: {
                                    ...fields,
                                    publicId

                                }
                            }));
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
                where: { userId: args.userId, eventId },
            });

            if (existingEventResponse) {
                const desired: Prisma.EventUserResponseUncheckedUpdateInput = {};
                let isEventResponseDifferent = false;
                if (args.comment !== undefined) {
                    desired.userComment = args.comment;
                    isEventResponseDifferent ||= args.comment !== existingEventResponse.userComment;
                }
                if (args.instrumentId !== undefined) {
                    desired.instrumentId = instrumentId;
                    isEventResponseDifferent ||= instrumentId !== existingEventResponse.instrumentId;
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
                const fields: Omit<Prisma.EventUserResponseUncheckedCreateInput, "publicId"> = {
                    userId: args.userId,
                    eventId,
                    userComment: args.comment || "",
                    instrumentId,
                    isInvited: args.isInvited,
                    revision: 1,
                };
                const inserted = await db3Server.table(db3.xEventUserResponse)
                    .createWithPublicId(publicId =>
                        transactionalDb.eventUserResponse.create({
                            data: {
                                ...fields,
                                publicId
                            }
                        }));
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
