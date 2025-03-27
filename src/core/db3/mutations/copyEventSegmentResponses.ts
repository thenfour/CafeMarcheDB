// copyEventSegmentResponses
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { z } from "zod";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";

const ZArgs = z.object({
    fromEventSegmentId: z.number(),
    toEventSegmentId: z.number(),
});

type TArgs = z.infer<typeof ZArgs>;

type CompactResponses = {
    userId: number,
    attendanceId: number,
}[];

const getTransformedValues = (oldValues: Prisma.EventSegmentUserResponseGetPayload<{}>[]): CompactResponses => oldValues
    .filter(r => !!r.attendanceId)
    .map(r => ({
        attendanceId: r.attendanceId!,
        userId: r.userId,
    }));


// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.zod(ZArgs),
    resolver.authorize(Permission.admin_events),
    async (args: TArgs, ctx: AuthenticatedCtx) => {

        await db.$transaction(async (transactionalDb) => {

            const table = db3.xEventSegmentUserResponse;
            const contextDesc = `copyEventSegmentResponses`;
            const changeContext = CreateChangeContext(contextDesc);

            const eventId = (await transactionalDb.eventSegment.findFirstOrThrow({ select: { eventId: true }, where: { id: args.toEventSegmentId } })).eventId;

            const sourceValues = await transactionalDb.eventSegmentUserResponse.findMany({ where: { eventSegmentId: args.fromEventSegmentId } });

            const oldToValues = await transactionalDb.eventSegmentUserResponse.findMany({ where: { eventSegmentId: args.toEventSegmentId } });

            await transactionalDb.eventSegmentUserResponse.deleteMany({
                where: { eventSegmentId: args.toEventSegmentId }
            });

            // now copy.
            const prismaInputs: Prisma.EventSegmentUserResponseCreateManyInput[] = sourceValues.map(s => ({
                eventSegmentId: args.toEventSegmentId,
                userId: s.userId,
                attendanceId: s.attendanceId,
            }));
            await db.eventSegmentUserResponse.createMany({ data: prismaInputs });

            await mutationCore.CallMutateEventHooks({
                tableNameOrSpecialMutationKey: "mutation:copyEventSegmentResponses",
                model: { id: eventId },
                db: transactionalDb,
            });

            await RegisterChange({
                action: ChangeAction.update,
                changeContext,
                table: table.tableName,
                pkid: args.toEventSegmentId,
                oldValues: getTransformedValues(oldToValues),
                newValues: getTransformedValues(sourceValues), // assumes doesn't refer to the segment!
                ctx,
                db: transactionalDb,
            });
        });

        return null;
    }
);

