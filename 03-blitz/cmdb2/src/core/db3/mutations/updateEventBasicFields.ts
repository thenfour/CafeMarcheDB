// updateEventBasicFields
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateEventBasicFieldsArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize("updateEventBasicFields", Permission.change_own_userInfo),
    async (args: TupdateEventBasicFieldsArgs, ctx: AuthenticatedMiddlewareCtx) => {

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.EventUncheckedUpdateInput = {
            name: args.name,
            slug: args.slug,
            description: args.description,
            typeId: args.typeId,
            visiblePermissionId: args.visiblePermissionId,
            locationDescription: args.locationDescription,
            locationURL: args.locationURL,
            isDeleted: args.isDeleted,
            statusId: args.statusId,
            createdByUserId: args.createdByUserId, // TODO: validate client info
        };

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        mutationCore.updateImpl(db3.xEvent, args.eventId, fields, ctx, currentUser);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

