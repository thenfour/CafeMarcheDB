// clearEventSegmentResponses
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { z } from "zod";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";

const ZArgs = z.object({
    eventSegmentId: z.number(),
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

        await db.$transaction(async () => {
            const table = db3.xEventSegmentUserResponse;
            const contextDesc = `clearEventSegmentResponses`;
            const changeContext = CreateChangeContext(contextDesc);

            const eventId = (await db.eventSegment.findFirstOrThrow({ select: { eventId: true }, where: { id: args.eventSegmentId } })).eventId;

            const oldValues = await db.eventSegmentUserResponse.findMany({ where: { eventSegmentId: args.eventSegmentId } });
            if (!oldValues.length) {
                return null;
            }

            await db.eventSegmentUserResponse.deleteMany({
                where: { eventSegmentId: args.eventSegmentId }
            });

            await mutationCore.CallMutateEventHooks({
                tableNameOrSpecialMutationKey: "mutation:cleareventsegmentresponses",
                model: { id: eventId },
            });

            await RegisterChange({
                action: ChangeAction.delete,
                changeContext,
                table: table.tableName,
                pkid: args.eventSegmentId,
                oldValues: getTransformedValues(oldValues),
                newValues: undefined,
                ctx,
            });
        });

        return null;
    }
);

